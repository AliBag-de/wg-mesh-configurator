export type EndpointVersion = "ipv4" | "ipv6";
export type TopologyType = "full_mesh" | "partial_mesh";

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
  sshHost?: string;
  wgIp?: string;
};

export type ClientInput = {
  id: string;
  name: string;
  publicKey: string;
  privateKey?: string;
  presharedKey?: string;
  wgIp?: string;
  gateways?: string[];
  subnetRoutes?: string;
};

export type GeneratePayload = {
  networkCidr: string;
  interfaceName: string;
  endpointVersion: EndpointVersion;
  persistentKeepalive: number;
  includeIpForwarding: boolean;
  enableBabel: boolean;
  autoGenerateKeys: boolean;
  topology: TopologyType;
  nodes: NodeInput[];
  clients: ClientInput[];
  gatewayNodeNames: string[];
  mtu?: number;
};
