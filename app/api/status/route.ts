import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

interface PeerStatus {
    publicKey: string;
    preSharedKey: string;
    endpoint: string;
    allowedIps: string;
    latestHandshake: number;
    transferRx: number;
    transferTx: number;
    persistentKeepalive: string;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const interfaceName = searchParams.get("interface") || "wg0";

    try {
        // Execute `wg show <interface> dump`
        // Format: public-key, pre-shared-key, endpoint, allowed-ips, latest-handshake, transfer-rx, transfer-tx, persistent-keepalive
        const { stdout } = await execAsync(`wg show ${interfaceName} dump`);

        const lines = stdout.trim().split("\n");
        const statusMap: Record<string, PeerStatus> = {};

        // Skip the first line if it's the interface definition (usually key=value pair or just interface name in some versions, but dump usually has lines of peers)
        // Actually `wg show <int> dump` first line is the interface itself usually: 
        // private-key, public-key, listen-port, fw-mark
        // Subsequent lines are peers.

        // We will parse all lines and check which ones look like peers (8 fields).

        for (const line of lines) {
            const parts = line.split("\t");
            if (parts.length === 8) {
                // This is likely a peer
                const [
                    publicKey,
                    preSharedKey,
                    endpoint,
                    allowedIps,
                    latestHandshake,
                    transferRx,
                    transferTx,
                    persistentKeepalive
                ] = parts;

                statusMap[publicKey] = {
                    publicKey,
                    preSharedKey,
                    endpoint,
                    allowedIps,
                    latestHandshake: parseInt(latestHandshake, 10),
                    transferRx: parseInt(transferRx, 10),
                    transferTx: parseInt(transferTx, 10),
                    persistentKeepalive
                };
            }
        }

        return NextResponse.json(statusMap);

    } catch (error) {
        // Only log full error if it's NOT a "command not found" (expected in dev/docker without cap_add)
        // code 127 = command not found (linux/unix)
        // ENOENT = executable not found
        // "Unable to access interface: No such file or directory" means wg command ran but interface missing.

        const err = error as any;
        const stderr = err.stderr || "";

        // Check for common specific "innocent" errors to mute
        if (
            process.env.NODE_ENV === "development" ||
            err.code === 127 ||
            err.code === "ENOENT" ||
            stderr.includes("No such file or directory") ||
            stderr.includes("Unable to access interface")
        ) {
            // Quietly return mock data in dev or if interface simply isn't up yet
            console.warn(`[API] WireGuard status check skipped: ${stderr.trim() || "Command not found/Interface missing"}`);
            return NextResponse.json(generateMockData());
        }

        console.error("WG Status Error:", error);
        return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
    }
}

function generateMockData(): Record<string, PeerStatus> {
    // Generate some random status for testing UI
    // In a real scenario, we'd match against known keys, but here we just send some dummy data 
    // that the frontend will try to match. 
    // Since the frontend uses the keys IT knows, we can't easily guess them here without input.
    // However, for the mock to work visually, checking the frontend stores would be needed, 
    // but the API is stateless. 
    // Strategy: The frontend will receive this empty or random map. 
    // Actually, to verify the UI, let's just make sure the API works. 
    // The frontend will treat missing keys as "Offline".

    return {};
}
