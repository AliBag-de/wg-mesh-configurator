import { NodeInput, ClientInput } from "./types";
import { x25519 } from "@noble/curves/ed25519";

function toBase64(arr: Uint8Array) {
    return btoa(String.fromCharCode(...arr));
}

function fromBase64(str: string) {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function uuidv4() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

interface ParsedConfig {
    interface?: {
        privateKey?: string;
        listenPort?: number;
        address?: string;
        name?: string;
        mtu?: number;
    };
    peers: {
        publicKey?: string;
        presharedKey?: string;
        allowedIPs?: string;
        endpoint?: string;
        name?: string;
    }[];
}

export function parseWgConfig(text: string): ParsedConfig {
    const lines = text.split(/\r?\n/);
    const result: ParsedConfig = { peers: [] };

    let currentSection: "Interface" | "Peer" | null = null;
    let currentPeer: Partial<ParsedConfig["peers"][0]> | null = null;
    let lastComment: string | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("#")) {
            lastComment = trimmed.replace(/^#\s*/, "").trim();
            continue;
        }

        if (!trimmed) {
            // Optional: decide if empty lines clear the comment. 
            // Usually valid config has comment immediately before [Peer].
            // We'll keep it to be safe for sparse files, but might risk stale comments.
            // Given the user example, it seems tight.
            continue;
        }

        if (trimmed.toLowerCase() === "[interface]") {
            currentSection = "Interface";
            if (!result.interface) result.interface = {};
            if (lastComment) {
                result.interface.name = lastComment;
                lastComment = null;
            }
            continue;
        }

        if (trimmed.toLowerCase() === "[peer]") {
            currentSection = "Peer";
            if (currentPeer) {
                result.peers.push(currentPeer as any);
            }
            currentPeer = {};
            if (lastComment) {
                currentPeer.name = lastComment;
                lastComment = null;
            }
            continue;
        }

        const [key, ...values] = trimmed.split("=");
        if (!key || values.length === 0) {
            lastComment = null; // Reset if invalid line
            continue;
        }

        // It's a property line, so any previous comment was not for a new section
        lastComment = null;

        const cleanKey = key.trim().toLowerCase();
        const value = values.join("=").trim();

        if (currentSection === "Interface" && result.interface) {
            if (cleanKey === "privatekey") result.interface.privateKey = value;
            else if (cleanKey === "listenport") result.interface.listenPort = parseInt(value, 10);
            else if (cleanKey === "address") result.interface.address = value;
            else if (cleanKey === "mtu") result.interface.mtu = parseInt(value, 10);
        } else if (currentSection === "Peer" && currentPeer) {
            if (cleanKey === "publickey") currentPeer.publicKey = value;
            else if (cleanKey === "presharedkey") currentPeer.presharedKey = value;
            else if (cleanKey === "allowedips") currentPeer.allowedIPs = value;
            else if (cleanKey === "endpoint") currentPeer.endpoint = value;
        }
    }

    if (currentPeer) {
        result.peers.push(currentPeer as any);
    }

    return result;
}

export function convertConfigToMesh(
    config: ParsedConfig,
    currentNodes: NodeInput[],
    currentClients: ClientInput[]
): { nodes: NodeInput[]; clients: ClientInput[] } {
    const newNodes: NodeInput[] = [];
    const newClients: ClientInput[] = [];

    // Used to prevent duplicates within the import itself
    const importedPublicKeys = new Set<string>();

    const isNodeDuplicate = (pk: string) => currentNodes.some(n => n.publicKey === pk) || importedPublicKeys.has(pk);
    const isClientDuplicate = (pk: string) => currentClients.some(c => c.publicKey === pk) || importedPublicKeys.has(pk);

    // 1. Convert Interface to a Node
    if (config.interface) {
        const ip = config.interface.address?.split("/")[0] || "";
        const existingNode = currentNodes.find(n => n.privateKey === config.interface?.privateKey);

        if (!existingNode) {
            let derivedPubKey = "";
            if (config.interface.privateKey) {
                try {
                    const priv = fromBase64(config.interface.privateKey);
                    const pub = x25519.getPublicKey(priv);
                    derivedPubKey = toBase64(pub);
                } catch (e) {
                    console.error("Failed to derive public key from imported private key", e);
                }
            }

            const newNode: NodeInput = {
                id: uuidv4(),
                name: config.interface.name || `Main Server (${currentNodes.length + newNodes.length + 1})`,
                privateKey: config.interface.privateKey,
                publicKey: derivedPubKey,
                presharedKey: "",
                listenPort: config.interface.listenPort || 51820,
                endpoint: ip,
                wgIp: ip
            };
            newNodes.push(newNode);
            if (derivedPubKey) importedPublicKeys.add(derivedPubKey);
        }
    }

    // 2. Convert Peers
    config.peers.forEach((peer, i) => {
        if (!peer.publicKey) return;

        // Prefer parsed name from comment, fallback to generic
        const baseName = peer.name || (peer.endpoint ? `Imported Node ${i + 1}` : `Imported Client ${i + 1}`);

        if (peer.endpoint) {
            // It's a Node
            if (!isNodeDuplicate(peer.publicKey)) {
                // Handle IPv6 parsing with brackets
                let host = peer.endpoint;
                let port = "51820";

                const lastColonIndex = peer.endpoint.lastIndexOf(":");
                const closeBracketIndex = peer.endpoint.lastIndexOf("]");

                if (closeBracketIndex !== -1) {
                    // It has IPv6
                    if (lastColonIndex > closeBracketIndex) {
                        host = peer.endpoint.substring(0, lastColonIndex);
                        port = peer.endpoint.substring(lastColonIndex + 1);
                    } else {
                        host = peer.endpoint;
                    }
                    host = host.replace(/^\[|\]$/g, "");
                } else {
                    // IPv4 or Hostname
                    if (lastColonIndex !== -1) {
                        host = peer.endpoint.substring(0, lastColonIndex);
                        port = peer.endpoint.substring(lastColonIndex + 1);
                    }
                }

                newNodes.push({
                    id: uuidv4(),
                    name: peer.name || `Peer Node ${newNodes.length + i + 1}`,
                    publicKey: peer.publicKey,
                    presharedKey: peer.presharedKey || "",
                    endpoint: host,
                    listenPort: parseInt(port, 10) || 51820,
                    wgIp: peer.allowedIPs?.split(",")[0]?.split("/")[0]?.trim() || ""
                });
                importedPublicKeys.add(peer.publicKey);
            }
        } else {
            // It's a Client
            if (!isClientDuplicate(peer.publicKey)) {
                newClients.push({
                    id: uuidv4(),
                    name: peer.name || `Imported Client ${newClients.length + i + 1}`,
                    publicKey: peer.publicKey,
                    presharedKey: peer.presharedKey || "",
                    privateKey: "",
                    wgIp: peer.allowedIPs?.split(",")[0]?.split("/")[0]?.trim() || ""
                });
                importedPublicKeys.add(peer.publicKey);
            }
        }
    });

    return { nodes: newNodes, clients: newClients };
}
