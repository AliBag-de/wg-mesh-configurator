import { ClientInput, NodeInput, EndpointVersion } from "./types";

function formatEndpoint(endpoint: string, version: "ipv4" | "ipv6", port: number) {
    if (version === "ipv6") {
        const trimmed = endpoint.replace(/^\[|\]$/g, "");
        return `[${trimmed}]:${port}`;
    }
    return `${endpoint}:${port}`;
}

export function generateClientConfig(
    client: ClientInput,
    clientIp: string,
    gatewayNodes: NodeInput[],
    networkCidr: string,
    endpointVersion: EndpointVersion,
    persistentKeepalive: number,
    mtu: number | undefined,
    presharedKeys: Record<string, string> // Map of GatewayName -> PSK
): string {

    const lines = [
        "[Interface]",
        `Address = ${clientIp}/32`,
        `PrivateKey = ${client.privateKey}`
    ];

    if (mtu) {
        lines.push(`MTU = ${mtu}`);
    }

    let allowedIps = networkCidr;
    if (client.subnetRoutes) {
        const subnets = client.subnetRoutes.split(',').map(s => s.trim()).filter(Boolean);
        if (subnets.length > 0) {
            allowedIps += `, ${subnets.join(', ')}`;
        }
    }

    gatewayNodes.forEach(gateway => {
        const psk = presharedKeys[gateway.name];
        lines.push(
            "",
            `# ${gateway.name}`,
            "[Peer]",
            `PublicKey = ${gateway.publicKey}`,
            `PresharedKey = ${psk}`,
            `AllowedIPs = ${allowedIps}`,
            `Endpoint = ${formatEndpoint(gateway.endpoint, endpointVersion, gateway.listenPort)}`,
            `PersistentKeepalive = ${persistentKeepalive}`
        );
    });

    return lines.join("\n");
}
