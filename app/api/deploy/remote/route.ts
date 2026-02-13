import { NextRequest, NextResponse } from "next/server";
import { resolveMeshState, generateNodeConfig } from "@/lib/generate";
import { remoteDeployer } from "@/lib/provisioning/remote-deployer";
import { GeneratePayload } from "@/lib/types";
import { deriveDeterministicPsk } from "@/lib/psk";

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

        if (!targetNode.endpoint) {
            return NextResponse.json({ error: "Node has no endpoint/IP address." }, { status: 400 });
        }

        if (!targetNode.sshUser || !targetNode.sshPort) {
            return NextResponse.json({ error: "SSH user or port not configured for this node." }, { status: 400 });
        }

        // 3. Generate PSK getter (same as in generateZip)
        const pskMap = new Map<string, string>();
        const getPsk = (a: string, b: string) => {
            const sorted = [a, b].sort();
            const key = `${sorted[0]}::${sorted[1]}`;
            if (!pskMap.has(key)) {
                pskMap.set(key, deriveDeterministicPsk(a, b));
            }
            return pskMap.get(key)!;
        };

        // 4. Generate config string
        const configContent = generateNodeConfig(
            targetNode.name,
            resolvedNodes,
            resolvedClients,
            nodeIps,
            {
                interfaceName: p.interfaceName,
                endpointVersion: p.endpointVersion,
                persistentKeepalive: p.persistentKeepalive,
                includeIpForwarding: p.includeIpForwarding,
                gatewayNodeNames: p.gatewayNodeNames
            },
            getPsk
        );

        // 5. Deploy via SSH
        const result = await remoteDeployer.deploy({
            host: targetNode.endpoint,
            port: targetNode.sshPort,
            user: targetNode.sshUser,
            interfaceName: p.interfaceName,
            configContent
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
