import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import { Peer, RuntimeInterface, RuntimePeer, SystemInfo } from "./contracts";

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

    async getInterface(name: string): Promise<RuntimeInterface> {
        try {
            // 1. wg show <interface> dump
            const output = await this.runCommand("wg", ["show", name, "dump"]);
            const lines = output.trim().split("\n");

            if (lines.length === 0) return { exists: false, peers: [] };

            const peers: RuntimePeer[] = [];
            let interfaceInfo: Partial<RuntimeInterface> = {};

            for (let i = 0; i < lines.length; i++) {
                const parts = lines[i].split("\t");
                if (i === 0 && parts.length === 4) {
                    interfaceInfo = {
                        privateKey: parts[0] === "(none)" ? undefined : parts[0],
                        publicKey: parts[1] === "(none)" ? undefined : parts[1],
                        listenPort: parseInt(parts[2]),
                        fwmark: parts[3] === "off" ? undefined : parseInt(parts[3])
                    };
                } else if (parts.length === 8) {
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

            // 2. Try to get MTU from ip link
            try {
                const ipOutput = await this.runCommand("ip", ["link", "show", name]);
                const mtuMatch = ipOutput.match(/mtu\s+(\d+)/);
                if (mtuMatch) {
                    interfaceInfo.mtu = parseInt(mtuMatch[1]);
                }
            } catch (e) {
                // Ignore ip link errors
            }

            // 3. Try to read .conf file for extra metadata
            try {
                const confPath = `/etc/wireguard/${name}.conf`;
                const confContent = await fs.readFile(confPath, "utf-8");
                interfaceInfo.confPath = confPath;
                // Basic parsing for DNS/Table if needed
                const dnsMatch = confContent.match(/DNS\s*=\s*(.+)/);
                if (dnsMatch) interfaceInfo.dns = dnsMatch[1].trim();
                const tableMatch = confContent.match(/Table\s*=\s*(.+)/);
                if (tableMatch) interfaceInfo.table = tableMatch[1].trim();
            } catch (e) {
                // Ignore conf file errors
            }

            return { exists: true, ...interfaceInfo, peers };
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

    async getSystemInfo(): Promise<SystemInfo> {
        try {
            const [hostname, version] = await Promise.all([
                this.runCommand("hostname", []).then(s => s.trim()),
                this.runCommand("wg", ["--version"]).then(s => s.trim())
            ]);
            return { hostname, version };
        } catch (e) {
            return { hostname: "unknown", version: "unknown" };
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
        if (peer.persistentKeepalive !== undefined) {
            args.push("persistent-keepalive", peer.persistentKeepalive.toString());
        }

        if (peer.presharedKey) {
            const tmpPskFile = `/tmp/wg-psk-${interfaceName}-${peer.publicKey.substring(0, 8)}`;
            await fs.writeFile(tmpPskFile, peer.presharedKey, { mode: 0o600 });
            try {
                args.push("preshared-key", tmpPskFile);
                await this.runCommand("wg", args);
            } finally {
                await fs.unlink(tmpPskFile).catch(() => { });
            }
        } else {
            await this.runCommand("wg", args);
        }
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

    async upInterface(name: string, config: { privateKey: string, listenPort: number, address: string }) {
        // 1. Ensure interface exists
        const names = await this.listInterfaces();
        if (!names.includes(name)) {
            await this.runCommand("ip", ["link", "add", name, "type", "wireguard"]);
        }

        // 2. Set Config
        // We use a temporary file for the private key to avoid leaking it in process list
        // but for simplicity here we use stdin if possible or just args if we must.
        // Actually, wg set supports stdin: `echo <key> | wg set <name> private-key /dev/stdin`
        // But since we are using execFile, we can't easily pipe.
        // We'll use a temporary file.
        const tmpKeyFile = `/tmp/wg-key-${name}`;
        await fs.writeFile(tmpKeyFile, config.privateKey, { mode: 0o600 });
        try {
            await this.runCommand("wg", ["set", name, "private-key", tmpKeyFile, "listen-port", config.listenPort.toString()]);
        } finally {
            await fs.unlink(tmpKeyFile).catch(() => { });
        }

        // 3. Set IP Address
        // Remove existing IPs first or just add? Usually we want to stay clean.
        // ip addr show <name> | grep inet
        // This is getting complex, let's just add it and ignore error if exists.
        try {
            await this.runCommand("ip", ["addr", "add", config.address, "dev", name]);
        } catch (e: any) {
            if (!e.message.includes("File exists")) throw e;
        }

        // 4. Bring UP
        await this.toggleInterface(name, true);
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
