import { NextRequest, NextResponse } from "next/server";
import { remoteDeployer } from "@/lib/provisioning/remote-deployer";
import { Peer } from "@/lib/provisioning/contracts";

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            function sendEvent(data: Record<string, any>) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            try {
                const { peer, targets, interfaceName, sshKeyContent } = await req.json() as {
                    peer: { publicKey: string; allowedIps: string[]; endpoint?: string; persistentKeepalive?: number };
                    targets: Array<{ id: string; name: string; host: string; port: number; user: string }>;
                    interfaceName: string;
                    sshKeyContent?: string;
                };

                if (!peer || !peer.publicKey || !peer.allowedIps || peer.allowedIps.length === 0) {
                    sendEvent({ error: "Invalid peer configuration", status: "error" });
                    controller.close();
                    return;
                }

                if (!targets || targets.length === 0) {
                    sendEvent({ error: "No target servers selected", status: "error" });
                    controller.close();
                    return;
                }

                sendEvent({ log: `[System] Starting "Add To Remote" push for peer ${peer.publicKey.slice(0, 8)}... to ${targets.length} targets.\n`, status: "running" });

                // Build the wg set command
                const allowedIpsStr = peer.allowedIps.join(",");
                let wgSetCmd = `wg set ${interfaceName} peer ${peer.publicKey} allowed-ips ${allowedIpsStr}`;
                if (peer.endpoint) {
                    wgSetCmd += ` endpoint ${peer.endpoint}`;
                }
                if (peer.persistentKeepalive) {
                    wgSetCmd += ` persistent-keepalive ${peer.persistentKeepalive}`;
                }

                // Build the wg0.conf appending command (idempotent-ish using grep)
                const peerBlock = `\\n[Peer]\\nPublicKey = ${peer.publicKey}\\nAllowedIPs = ${peer.allowedIps.join(", ")}\\n${peer.endpoint ? `Endpoint = ${peer.endpoint}\\n` : ""}${peer.persistentKeepalive ? `PersistentKeepalive = ${peer.persistentKeepalive}\\n` : ""}`;
                const confFile = `/etc/wireguard/${interfaceName}.conf`;
                const appendCmd = `grep -q "${peer.publicKey}" ${confFile} || echo -e "${peerBlock}" >> ${confFile}`;

                const remoteCommands = `sudo ${wgSetCmd} && sudo bash -c '${appendCmd}'`;

                for (const target of targets) {
                    sendEvent({ log: `\n[${target.name}] Connecting via SSH to ${target.user}@${target.host}:${target.port}...\n`, status: "running" });

                    try {
                        const result = await remoteDeployer.executeRawCommand({
                            host: target.host,
                            port: target.port,
                            user: target.user,
                            privateKeyContent: sshKeyContent,
                            command: remoteCommands,
                            onLog: (msg) => {
                                sendEvent({ log: `[${target.name}] ` + msg, status: "running" });
                            }
                        });

                        if (result.success) {
                            sendEvent({
                                nodeId: target.id,
                                status: "success",
                                log: `[${target.name}] Successfully added peer.\n`
                            });
                        } else {
                            // Fallback / instructions generation on failure (e.g. Sudo needed)
                            const instructions = `--- Option A: Live Update (No restart) ---\nsudo ${wgSetCmd}\n\n--- Option B: Path to Persistence ---\nAppend these blocks to ${confFile}:\n[Peer]\nPublicKey = ${peer.publicKey}\nAllowedIPs = ${peer.allowedIps.join(", ")}\n${peer.endpoint ? `Endpoint = ${peer.endpoint}\n` : ""}${peer.persistentKeepalive ? `PersistentKeepalive = ${peer.persistentKeepalive}\n` : ""}`;

                            sendEvent({
                                nodeId: target.id,
                                status: "error",
                                error: `Failed on ${target.name}. ` + (result.log.includes("sudo: a password is required") ? "Sudo password required." : "Check logs."),
                                instructions: instructions
                            });
                        }
                    } catch (targetErr: any) {
                        console.error(`[Push Error on ${target.name}]`, targetErr);
                        sendEvent({
                            nodeId: target.id,
                            status: "error",
                            error: `SSH connection failed: ${targetErr.message}`
                        });
                    }
                }

                sendEvent({ log: `\n[System] Push operations completed.\n`, status: "finished" });
                controller.close();

            } catch (error: any) {
                console.error("[Deploy Push API]", error);
                sendEvent({ error: error.message || "Internal Server Error", status: "error" });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        }
    });
}
