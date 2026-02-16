import { NextRequest, NextResponse } from "next/server";
import { resolveMeshState, generateNodeAssets } from "@/lib/generate";
import { remoteDeployer } from "@/lib/provisioning/remote-deployer";
import { GeneratePayload } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const { payload, nodeName } = await req.json() as { payload: GeneratePayload, nodeName: string };

        // 1. Resolve mesh state
        const { resolvedNodes, resolvedClients, nodeIps, payload: p } = resolveMeshState(payload);

        // 2. Find target node
        const targetNode = resolvedNodes.find(n => n.name === nodeName);
        if (!targetNode) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        if (!targetNode.endpoint && !targetNode.sshHost) {
            return NextResponse.json({ error: "Node has no SSH Host or Public Endpoint configured." }, { status: 400 });
        }

        if (!targetNode.sshUser || !targetNode.sshPort) {
            return NextResponse.json({ error: "SSH user or port not configured for this node." }, { status: 400 });
        }

        // 3. Generate all node assets (conf, babel, setup)
        const files = generateNodeAssets(targetNode.name, payload);

        // 4. Deploy via SSH
        const result = await remoteDeployer.deploy({
            host: targetNode.sshHost || targetNode.endpoint,
            port: targetNode.sshPort,
            user: targetNode.sshUser,
            interfaceName: p.interfaceName,
            files: files
        });

        if (!result.success) {
            return NextResponse.json({ error: "Deployment failed", log: result.log }, { status: 500 });
        }

        return NextResponse.json({ success: true, log: result.log });

    } catch (error: any) {
        console.error("[Remote Deploy API]", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
