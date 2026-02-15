import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

export async function GET() {
    try {
        const sshConfigPath = path.join(os.homedir(), ".ssh", "config");

        try {
            const content = await fs.readFile(sshConfigPath, "utf-8");
            const lines = content.split("\n");
            const hosts: string[] = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                // Match "Host " at the beginning, but ignore wildcards
                if (trimmed.toLowerCase().startsWith("host ") && !trimmed.includes("*") && !trimmed.includes("?")) {
                    const hostPart = trimmed.substring(5).trim();
                    // Some configs might have multiple hosts on one line: Host srv1 srv2
                    const parts = hostPart.split(/\s+/);
                    parts.forEach(p => {
                        if (p && !hosts.includes(p)) {
                            hosts.push(p);
                        }
                    });
                }
            });

            return NextResponse.json({ hosts: hosts.sort() });
        } catch (err) {
            // If file doesn't exist, just return empty list
            return NextResponse.json({ hosts: [] });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
