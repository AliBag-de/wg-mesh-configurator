import { NextRequest, NextResponse } from "next/server";
import { resolveMeshState, generateNodeAssets } from "@/lib/generate";
import { remoteDeployer } from "@/lib/provisioning/remote-deployer";
import { GeneratePayload } from "@/lib/types";

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            function sendEvent(data: Record<string, any>) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }

            try {
                const { payload, nodeName } = await req.json() as { payload: GeneratePayload, nodeName: string };

                // 1. Resolve mesh state
                const { resolvedNodes, resolvedClients, nodeIps, payload: p } = resolveMeshState(payload);

                // 2. Find target node
                const targetNodeIndex = resolvedNodes.findIndex(n => n.name === nodeName);
                if (targetNodeIndex === -1) {
                    sendEvent({ error: "Node not found", status: "error" });
                    controller.close();
                    return;
                }
                const targetNode = resolvedNodes[targetNodeIndex];
                const peerIpsToPing = nodeIps.filter((_, i) => i !== targetNodeIndex);

                if (!targetNode.endpoint && !targetNode.sshHost) {
                    sendEvent({ error: "Node has no SSH Host or Public Endpoint configured.", status: "error" });
                    controller.close();
                    return;
                }

                if (!targetNode.sshUser || !targetNode.sshPort) {
                    sendEvent({ error: "SSH user or port not configured for this node.", status: "error" });
                    controller.close();
                    return;
                }

                // 3. Generate assets
                sendEvent({ log: `[System] Generated WireGuard configurations for ${targetNode.name}...\n`, status: "running" });
                const files = generateNodeAssets(targetNode.name, payload);

                // 4. Deploy via SSH with streaming logs
                const result = await remoteDeployer.deploy({
                    host: targetNode.sshHost || targetNode.endpoint,
                    port: targetNode.sshPort,
                    user: targetNode.sshUser,
                    interfaceName: p.interfaceName,
                    files: files,
                    peerIpsToPing: peerIpsToPing,
                    onLog: (msg) => {
                        sendEvent({ log: msg, status: "running" });
                    }
                });

                if (!result.success) {
                    sendEvent({ log: `\n[Fatal] Deployment process failed.\n`, error: "Deployment failed", status: "error" });
                    controller.close();
                    return;
                }

                // Finish stream
                sendEvent({ log: "\n[System] All remote operations completed.\n", status: "success" });
                controller.close();

            } catch (error: any) {
                console.error("[Remote Deploy API]", error);
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
