import JSZip from "jszip";
import crypto from "crypto";
import { x25519 } from "@noble/curves/ed25519";
import { GeneratePayload } from "./types";
import { deriveDeterministicPsk } from "./psk";

type ParsedCidr = {
  base: number;
  prefix: number;
  size: number;
  last: number;
};

import { ipToInt, intToIp, parseCidr } from "./ip-utils";

const MAX_IPV4 = 0xffffffff;

function formatEndpoint(endpoint: string, version: "ipv4" | "ipv6", port: number) {
  if (version === "ipv6") {
    const trimmed = endpoint.replace(/^\[|\]$/g, "");
    return `[${trimmed}]:${port}`;
  }
  return `${endpoint}:${port}`;
}

function safeName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function neighborIndexes(index: number, count: number): number[] {
  if (count <= 1) return [];
  if (count === 2) return [index === 0 ? 1 : 0];
  if (count === 3) return [0, 1, 2].filter((i) => i !== index);

  const offsets = count < 6 ? [1] : [1, 3];
  const neighbors = new Set<number>();
  for (const offset of offsets) {
    neighbors.add((index + offset) % count);
    neighbors.add((index - offset + count) % count);
  }
  neighbors.delete(index);
  return Array.from(neighbors);
}

function encodeBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function decodeBase64(value: string) {
  try {
    return new Uint8Array(Buffer.from(value, "base64"));
  } catch {
    return null;
  }
}

function generateKeypair() {
  const privateKeyBytes = crypto.randomBytes(32);
  const publicKeyBytes = x25519.getPublicKey(privateKeyBytes);
  return {
    privateKey: encodeBase64(privateKeyBytes),
    publicKey: encodeBase64(publicKeyBytes)
  };
}

function derivePublicKey(privateKey: string) {
  const bytes = decodeBase64(privateKey);
  if (!bytes || bytes.length !== 32) {
    throw new Error("Private key base64 gecersiz.");
  }
  return encodeBase64(x25519.getPublicKey(bytes));
}

function ensure(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export function resolveMeshState(payload: GeneratePayload) {
  const {
    networkCidr,
    interfaceName,
    endpointVersion,
    persistentKeepalive,
    includeIpForwarding,
    enableBabel,
    autoGenerateKeys,
    nodes,
    clients,
    gatewayNodeNames
  } = payload;

  ensure(nodes.length > 0, "En az 1 node gerekli.");
  ensure(networkCidr.length > 0, "IPv4 CIDR gerekli.");
  ensure(interfaceName.trim().length > 0, "Interface ismi gerekli.");

  const parsed = parseCidr(networkCidr);
  const serverStart = parsed.base + 1;
  const clientStart = parsed.base + 101;

  ensure(serverStart + nodes.length <= parsed.last, "Node sayisi CIDR'a sigmiyor.");
  ensure(
    clientStart + clients.length <= parsed.last,
    "Client sayisi CIDR'a sigmiyor."
  );

  const nodeMap = new Map<string, typeof nodes[number]>();
  nodes.forEach((node) => nodeMap.set(node.name, node));
  gatewayNodeNames.forEach((name) => {
    ensure(nodeMap.has(name), `Gateway node bulunamadi: ${name}`);
  });

  const nodeIps = nodes.map((_, i) => intToIp(serverStart + i));
  const clientIps = clients.map((_, i) => intToIp(clientStart + i));

  const resolvedNodes = nodes.map((node, i) => {
    let res = { ...node, address: `${nodeIps[i]}/32` };
    if (autoGenerateKeys && !node.publicKey && !node.privateKey) {
      const keypair = generateKeypair();
      res = { ...res, ...keypair };
    } else if (node.privateKey && !node.publicKey) {
      res = { ...res, publicKey: derivePublicKey(node.privateKey) };
    }
    return res;
  });

  const resolvedClients = clients.map((client, i) => {
    let res = { ...client, address: `${clientIps[i]}/32` };
    if (autoGenerateKeys && !client.publicKey && !client.privateKey) {
      const keypair = generateKeypair();
      res = { ...res, ...keypair };
    } else if (client.privateKey && !client.publicKey) {
      res = { ...res, publicKey: derivePublicKey(client.privateKey) };
    }
    return res;
  });

  return {
    resolvedNodes,
    resolvedClients,
    nodeIps,
    clientIps,
    parsed,
    payload
  };
}

export function generateNodeConfig(
  nodeName: string,
  resolvedNodes: any[],
  resolvedClients: any[],
  nodeIps: string[],
  config: {
    interfaceName: string;
    endpointVersion: "ipv4" | "ipv6";
    persistentKeepalive: number;
    includeIpForwarding: boolean;
    gatewayNodeNames: string[];
  },
  pskGetter: (a: string, b: string) => string
): string {
  const nodeIndex = resolvedNodes.findIndex((n) => n.name === nodeName);
  if (nodeIndex === -1) throw new Error(`Node not found: ${nodeName}`);

  const node = resolvedNodes[nodeIndex];
  const nodeIp = nodeIps[nodeIndex];
  const neighbors = neighborIndexes(nodeIndex, resolvedNodes.length);

  const lines: string[] = [
    "[Interface]",
    `Address = ${nodeIp}/32`,
    `ListenPort = ${node.listenPort}`,
    `PrivateKey = ${node.privateKey}`
  ];

  if (config.includeIpForwarding) {
    lines.push(
      "PostUp = sysctl -w net.ipv4.ip_forward=1",
      "PostDown = sysctl -w net.ipv4.ip_forward=0"
    );
  }

  for (const neighborIndex of neighbors) {
    const peer = resolvedNodes[neighborIndex];
    const peerIp = nodeIps[neighborIndex];
    const psk = pskGetter(node.name, peer.name);
    lines.push(
      "",
      `# ${peer.name}`,
      "[Peer]",
      `PublicKey = ${peer.publicKey}`,
      `PresharedKey = ${psk}`,
      `AllowedIPs = ${peerIp}/32`,
      `Endpoint = ${formatEndpoint(peer.endpoint, config.endpointVersion, peer.listenPort)}`,
      `PersistentKeepalive = ${config.persistentKeepalive}`
    );
  }

  if (config.gatewayNodeNames.includes(node.name)) {
    for (const client of resolvedClients) {
      const psk = pskGetter(client.name, node.name);
      lines.push(
        "",
        `# ${client.name}`,
        "[Peer]",
        `PublicKey = ${client.publicKey}`,
        `PresharedKey = ${psk}`,
        `AllowedIPs = ${client.address}`
      );
    }
  }

  return lines.join("\n");
}

export async function generateZip(payload: GeneratePayload) {
  const {
    resolvedNodes,
    resolvedClients,
    nodeIps,
    clientIps,
    payload: p
  } = resolveMeshState(payload);

  const {
    networkCidr,
    interfaceName,
    endpointVersion,
    persistentKeepalive,
    includeIpForwarding,
    enableBabel,
    autoGenerateKeys,
    gatewayNodeNames
  } = p;

  const resolvedNodeMap = new Map<string, typeof resolvedNodes[number]>();
  resolvedNodes.forEach((node) => resolvedNodeMap.set(node.name, node));

  const pskMap = new Map<string, string>();
  const getPairKey = (a: string, b: string) => {
    const sorted = [a, b].sort();
    return `${sorted[0]}::${sorted[1]}`;
  };
  const getPsk = (a: string, b: string) => {
    const key = getPairKey(a, b);
    if (!pskMap.has(key)) {
      pskMap.set(key, deriveDeterministicPsk(a, b));
    }
    return pskMap.get(key)!;
  };

  const zip = new JSZip();
  const interfaceFilename = `${safeName(interfaceName)}.conf`;
  const manifest: Record<string, unknown> = {
    networkCidr,
    interfaceName,
    endpointVersion,
    autoGenerateKeys,
    nodes: [],
    clients: [],
    neighbors: {},
    pskPairs: {}
  };

  resolvedNodes.forEach((node, i) => {
    const nodeIp = nodeIps[i];
    const neighbors = neighborIndexes(i, resolvedNodes.length);
    const nodeConfig = generateNodeConfig(
      node.name,
      resolvedNodes,
      resolvedClients,
      nodeIps,
      {
        interfaceName,
        endpointVersion,
        persistentKeepalive,
        includeIpForwarding,
        gatewayNodeNames
      },
      getPsk
    );

    if (enableBabel) {
      const babelConfig = [
        `interface ${interfaceName}`,
        "redistribute local",
        `redistribute ip ${networkCidr}`
      ].join("\n");
      zip.file(`nodes/${safeName(node.name)}/babeld.conf`, babelConfig);
    }

    zip.file(`nodes/${safeName(node.name)}/${interfaceFilename}`, nodeConfig);

    (manifest.nodes as unknown[]).push({
      name: node.name,
      address: `${nodeIp}/32`,
      endpoint: node.endpoint,
      listenPort: node.listenPort,
      publicKey: node.publicKey
    });
    (manifest.neighbors as Record<string, string[]>)[node.name] = neighbors.map(
      (idx) => resolvedNodes[idx].name
    );
  });

  resolvedClients.forEach((client, i) => {
    const clientIp = clientIps[i];
    const clientLines: string[] = [
      "[Interface]",
      `Address = ${clientIp}/32`,
      `PrivateKey = ${client.privateKey}`
    ];

    for (const gatewayName of gatewayNodeNames) {
      const gateway = resolvedNodeMap.get(gatewayName);
      if (!gateway) {
        throw new Error(`Gateway node bulunamadi: ${gatewayName}`);
      }
      const psk = getPsk(client.name, gateway.name);
      clientLines.push(
        "",
        `# ${gateway.name}`,
        "[Peer]",
        `PublicKey = ${gateway.publicKey}`,
        `PresharedKey = ${psk}`,
        `AllowedIPs = ${networkCidr}`,
        `Endpoint = ${formatEndpoint(
          gateway.endpoint,
          endpointVersion,
          gateway.listenPort
        )}`,
        `PersistentKeepalive = ${persistentKeepalive}`
      );
    }

    zip.file(`clients/${safeName(client.name)}/${interfaceFilename}`, clientLines.join("\n"));

    (manifest.clients as unknown[]).push({
      name: client.name,
      address: `${clientIp}/32`,
      publicKey: client.publicKey,
      gateways: gatewayNodeNames
    });
  });

  manifest.pskPairs = Object.fromEntries(pskMap.entries());

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const content = await zip.generateAsync({ type: "uint8array" });
  return { content, filename: "wg-mesh-config.zip" };
}
