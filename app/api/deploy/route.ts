import { NextRequest, NextResponse } from "next/server";
import { resolveMeshState } from "@/lib/generate";
import { deployMeshConfig } from "@/lib/provisioning/service";
import { GeneratePayload } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const { payload, nodeName } = await req.json() as { payload: GeneratePayload, nodeName: string };

        // 1. Resolve the whole mesh state (keys, ips, etc)
        const { resolvedNodes, resolvedClients } = resolveMeshState(payload);

        // 2. Find the target node configuration
        const targetNode = resolvedNodes.find(n => n.name === nodeName);
        if (!targetNode) {
            return NextResponse.json({ error: "Node not found in configuration" }, { status: 404 });
        }

        if (!targetNode.privateKey) {
            return NextResponse.json({ error: "Node has no private key. Generate keys first." }, { status: 400 });
        }

        // 3. Prepare config for deployment
        const config = {
            interface: {
                name: targetNode.name,
                addressCidr: targetNode.address,
                listenPort: targetNode.listenPort,
                privateKey: targetNode.privateKey,
                publicKey: targetNode.publicKey,
            },
            peers: [] as any[]
        };

        // 4. Add other nodes as peers
        resolvedNodes.forEach((node) => {
            if (node.name === nodeName) return;
            config.peers.push({
                name: node.name,
                publicKey: node.publicKey,
                allowedIps: [node.address.split("/")[0] + "/32"],
                endpoint: node.endpoint ? `${node.endpoint}:${node.listenPort}` : undefined
            });
        });

        // 5. Add clients as peers
        resolvedClients.forEach(client => {
            config.peers.push({
                name: client.name,
                publicKey: client.publicKey,
                allowedIps: [client.address.split("/")[0] + "/32"]
            });
        });

        await deployMeshConfig(config);

        return NextResponse.json({ success: true, message: `Deployment for ${nodeName} successful.` });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Error" }, { status: 500 });
    }
}
