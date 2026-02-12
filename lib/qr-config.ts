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
    presharedKeys: Record<string, string> // Map of GatewayName -> PSK
): string {

    const lines = [
        "[Interface]",
        `Address = ${clientIp}/32`,
        `PrivateKey = ${client.privateKey}`,
        "DNS = 1.1.1.1" // Optional, but good for full tunnel
    ];

    gatewayNodes.forEach(gateway => {
        const psk = presharedKeys[gateway.name];
        lines.push(
            "",
            `# ${gateway.name}`,
            "[Peer]",
            `PublicKey = ${gateway.publicKey}`,
            `PresharedKey = ${psk}`,
            `AllowedIPs = 0.0.0.0/0, ::/0`, // Assume full tunnel for easy mobile use, or restrict to networkCidr
            `Endpoint = ${formatEndpoint(gateway.endpoint, endpointVersion, gateway.listenPort)}`,
            `PersistentKeepalive = ${persistentKeepalive}`
        );
    });

    return lines.join("\n");
}
