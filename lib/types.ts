export type EndpointVersion = "ipv4" | "ipv6";

export type NodeInput = {
  id: string;
  name: string;
  publicKey: string;
  privateKey?: string;
  presharedKey?: string;
  endpoint: string;
  listenPort: number;
  sshUser?: string;
  sshPort?: number;
};

export type ClientInput = {
  id: string;
  name: string;
  publicKey: string;
  privateKey?: string;
  presharedKey?: string;
};

export type GeneratePayload = {
  networkCidr: string;
  interfaceName: string;
  endpointVersion: EndpointVersion;
  persistentKeepalive: number;
  includeIpForwarding: boolean;
  enableBabel: boolean;
  autoGenerateKeys: boolean;
  nodes: NodeInput[];
  clients: ClientInput[];
  gatewayNodeNames: string[];
};
