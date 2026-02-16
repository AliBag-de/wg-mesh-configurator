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

            const hosts: any[] = [];
            let currentHost: any = null;

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) return;

                const [key, ...rest] = trimmed.split(/\s+/);
                const value = rest.join(" ").trim();

                if (key.toLowerCase() === "host") {
                    if (currentHost && currentHost.host && !currentHost.host.includes("*") && !currentHost.host.includes("?")) {
                        hosts.push(currentHost);
                    }
                    currentHost = { host: value };
                } else if (currentHost) {
                    if (key.toLowerCase() === "hostname") currentHost.hostname = value;
                    else if (key.toLowerCase() === "user") currentHost.user = value;
                    else if (key.toLowerCase() === "port") currentHost.port = parseInt(value, 10);
                }
            });

            if (currentHost && currentHost.host && !currentHost.host.includes("*") && !currentHost.host.includes("?")) {
                hosts.push(currentHost);
            }

            return NextResponse.json({ hosts });
        } catch (err) {
            return NextResponse.json({ hosts: [] });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
