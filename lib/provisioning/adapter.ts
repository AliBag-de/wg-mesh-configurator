import { execFile } from "child_process";
import { promisify } from "util";
import { Peer } from "./contracts";

// execFile is safer than exec as it doesn't spawn a shell by default
const execFileAsync = promisify(execFile);

export class WireGuardCommandError extends Error {
    code?: number | string;
    stderr?: string;
    constructor(message: string, code?: number | string, stderr?: string) {
        super(message);
        this.name = "WireGuardCommandError";
        this.code = code;
        this.stderr = stderr;
    }
}

export class WireGuardAdapter {
    private async runCommand(cmd: string, args: string[]): Promise<string> {
        try {
            const { stdout, stderr } = await execFileAsync(cmd, args);
            if (stderr) {
                console.warn(`[WG Adapter] stderr: ${stderr}`);
            }
            return stdout;
        } catch (error: any) {
            const stderr = (error?.stderr as string | undefined)?.trim();
            throw new WireGuardCommandError(
                `Command ${cmd} ${args.join(" ")} failed: ${stderr || error.message}`,
                error?.code,
                stderr
            );
        }
    }

    async getInterface(name: string) {
        try {
            // wg show <interface> dump
            const output = await this.runCommand("wg", ["show", name, "dump"]);
            const lines = output.trim().split("\n");

            if (lines.length === 0) return { exists: false, peers: [] };

            const peers: any[] = [];

            for (const line of lines) {
                const parts = line.split("\t");
                if (parts.length === 8) {
                    peers.push({
                        publicKey: parts[0],
                        presharedKey: parts[1] === "(none)" ? undefined : parts[1],
                        endpoint: parts[2] === "(none)" ? undefined : parts[2],
                        allowedIps: parts[3].split(","),
                        latestHandshake: parseInt(parts[4]),
                        transferRx: parseInt(parts[5]),
                        transferTx: parseInt(parts[6]),
                        persistentKeepalive: parts[7] === "off" ? undefined : parseInt(parts[7])
                    });
                }
            }

            return { exists: true, peers };
        } catch (e: any) {
            const stderr = (e?.stderr as string | undefined) || e?.message || "";
            if (
                stderr.includes("No such device") ||
                stderr.includes("Unable to access interface")
            ) {
                return { exists: false, peers: [] };
            }
            throw e;
        }
    }

    async addPeer(interfaceName: string, peer: Peer) {
        const args = [
            "set",
            interfaceName,
            "peer",
            peer.publicKey,
            "allowed-ips",
            peer.allowedIps.join(",")
        ];

        if (peer.endpoint) {
            args.push("endpoint", peer.endpoint);
        }
        // Fix: Allow 0 as valid value
        if (peer.persistentKeepalive !== undefined) {
            args.push("persistent-keepalive", peer.persistentKeepalive.toString());
        }

        await this.runCommand("wg", args);
    }

    async removePeer(interfaceName: string, publicKey: string, options?: { ignoreIfMissing?: boolean }) {
        try {
            await this.runCommand("wg", ["set", interfaceName, "peer", publicKey, "remove"]);
        } catch (error: any) {
            const stderr = (error?.stderr as string | undefined) || error?.message || "";
            if (
                options?.ignoreIfMissing &&
                (
                    stderr.includes("Unable to find") ||
                    stderr.includes("Cannot find") ||
                    stderr.includes("does not exist")
                )
            ) {
                return;
            }
            throw error;
        }
    }

    async updatePeer(interfaceName: string, peer: Peer) {
        await this.addPeer(interfaceName, peer);
    }

    async toggleInterface(name: string, isUp: boolean) {
        // Using `ip link set <name> up/down`
        // Requires iproute2 package in container
        const state = isUp ? "up" : "down";
        await this.runCommand("ip", ["link", "set", name, state]);
    }

    async listInterfaces(): Promise<string[]> {
        try {
            const output = await this.runCommand("wg", ["show", "interfaces"]);
            return output.trim().split(/\s+/).filter(Boolean);
        } catch (error) {
            // If no interfaces or wg fails, return empty
            return [];
        }
    }
}
