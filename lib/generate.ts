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

export async function generateZip(payload: GeneratePayload) {
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

  const resolvedNodes = nodes.map((node) => {
    if (autoGenerateKeys && !node.publicKey && !node.privateKey) {
      const keypair = generateKeypair();
      return { ...node, ...keypair };
    }
    if (node.privateKey && !node.publicKey) {
      return { ...node, publicKey: derivePublicKey(node.privateKey) };
    }
    if (!node.privateKey) {
      throw new Error(`Node ${node.name} icin private key gerekli.`);
    }
    if (!node.publicKey) {
      throw new Error(`Node ${node.name} icin public key gerekli.`);
    }
    return node;
  });

  const resolvedClients = clients.map((client) => {
    if (autoGenerateKeys && !client.publicKey && !client.privateKey) {
      const keypair = generateKeypair();
      return { ...client, ...keypair };
    }
    if (client.privateKey && !client.publicKey) {
      return { ...client, publicKey: derivePublicKey(client.privateKey) };
    }
    if (!client.privateKey) {
      throw new Error(`Client ${client.name} icin private key gerekli.`);
    }
    if (!client.publicKey) {
      throw new Error(`Client ${client.name} icin public key gerekli.`);
    }
    return client;
  });

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
    const nodeFileLines: string[] = [
      "[Interface]",
      `Address = ${nodeIp}/32`,
      `ListenPort = ${node.listenPort}`,
      `PrivateKey = ${node.privateKey}`
    ];

    if (includeIpForwarding) {
      nodeFileLines.push(
        "PostUp = sysctl -w net.ipv4.ip_forward=1",
        "PostDown = sysctl -w net.ipv4.ip_forward=0"
      );
    }

    for (const neighborIndex of neighbors) {
      const peer = resolvedNodes[neighborIndex];
      const peerIp = nodeIps[neighborIndex];
      const psk = getPsk(node.name, peer.name);
      nodeFileLines.push(
        "",
        `# ${peer.name}`,
        "[Peer]",
        `PublicKey = ${peer.publicKey}`,
        `PresharedKey = ${psk}`,
        `AllowedIPs = ${peerIp}/32`,
        `Endpoint = ${formatEndpoint(peer.endpoint, endpointVersion, peer.listenPort)}`,
        `PersistentKeepalive = ${persistentKeepalive}`
      );
    }

    if (enableBabel) {
      const babelConfig = [
        `interface ${interfaceName}`,
        "redistribute local",
        `redistribute ip ${networkCidr}`
      ].join("\n");
      zip.file(`nodes/${safeName(node.name)}/babeld.conf`, babelConfig);
    }

    if (gatewayNodeNames.includes(node.name)) {
      for (let clientIndex = 0; clientIndex < resolvedClients.length; clientIndex += 1) {
        const client = resolvedClients[clientIndex];
        const clientIp = clientIps[clientIndex];
        const psk = getPsk(client.name, node.name);
        nodeFileLines.push(
          "",
          `# ${client.name}`,
          "[Peer]",
          `PublicKey = ${client.publicKey}`,
          `PresharedKey = ${psk}`,
          `AllowedIPs = ${clientIp}/32`
        );
      }
    }

    zip.file(`nodes/${safeName(node.name)}/${interfaceFilename}`, nodeFileLines.join("\n"));

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
