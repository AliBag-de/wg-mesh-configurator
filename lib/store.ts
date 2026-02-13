import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ClientInput, EndpointVersion, NodeInput } from "./types";

type MeshState = {
  networkCidr: string;
  endpointVersion: EndpointVersion;
  interfaceName: string;
  persistentKeepalive: number;
  includeIpForwarding: boolean;
  enableBabel: boolean;
  autoGenerateKeys: boolean;
  nodes: NodeInput[];
  clients: ClientInput[];
  gatewayNodeNames: string[];
  gatewayTouched: boolean;
  setNetworkCidr: (value: string) => void;
  setEndpointVersion: (value: EndpointVersion) => void;
  setInterfaceName: (value: string) => void;
  setPersistentKeepalive: (value: number) => void;
  setIncludeIpForwarding: (value: boolean) => void;
  setEnableBabel: (value: boolean) => void;
  setAutoGenerateKeys: (value: boolean) => void;
  setNodes: (value: NodeInput[] | ((prev: NodeInput[]) => NodeInput[])) => void;
  setClients: (
    value: ClientInput[] | ((prev: ClientInput[]) => ClientInput[])
  ) => void;
  setGatewayNodeNames: (
    value: string[] | ((prev: string[]) => string[])
  ) => void;
  setGatewayTouched: (value: boolean) => void;
  resetAll: () => void;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultNode = (index: number): NodeInput => ({
  id: newId(),
  name: `S${index + 1}`,
  publicKey: "",
  presharedKey: "",
  endpoint: "",
  listenPort: 51820,
  sshUser: "root",
  sshPort: 22
});

const defaultClient = (index: number): ClientInput => ({
  id: newId(),
  name: `U${index + 1}`,
  publicKey: "",
  presharedKey: ""
});

const defaultState = () => ({
  networkCidr: "10.20.0.0/24",
  endpointVersion: "ipv6" as EndpointVersion,
  interfaceName: "wg0",
  persistentKeepalive: 25,
  includeIpForwarding: true,
  enableBabel: true,
  autoGenerateKeys: true,
  nodes: [defaultNode(0), defaultNode(1), defaultNode(2)],
  clients: [defaultClient(0), defaultClient(1), defaultClient(2)],
  gatewayNodeNames: [],
  gatewayTouched: false
});

export const useMeshStore = create<MeshState>()(
  persist(
    (set) => ({
      ...defaultState(),
      setNetworkCidr: (value) => set({ networkCidr: value }),
      setEndpointVersion: (value) => set({ endpointVersion: value }),
      setInterfaceName: (value) => set({ interfaceName: value }),
      setPersistentKeepalive: (value) => set({ persistentKeepalive: value }),
      setIncludeIpForwarding: (value) => set({ includeIpForwarding: value }),
      setEnableBabel: (value) => set({ enableBabel: value }),
      setAutoGenerateKeys: (value) => set({ autoGenerateKeys: value }),
      setNodes: (value) =>
        set((state) => ({
          nodes: typeof value === "function" ? value(state.nodes) : value
        })),
      setClients: (value) =>
        set((state) => ({
          clients: typeof value === "function" ? value(state.clients) : value
        })),
      setGatewayNodeNames: (value) =>
        set((state) => ({
          gatewayNodeNames:
            typeof value === "function" ? value(state.gatewayNodeNames) : value
        })),
      setGatewayTouched: (value) => set({ gatewayTouched: value }),
      resetAll: () => set(defaultState())
    }),
    {
      name: "wg-mesh-config",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        clients: state.clients,
        gatewayNodeNames: state.gatewayNodeNames,
        gatewayTouched: state.gatewayTouched
      })
    }
  )
);

export const clearMeshStorage = () => {
  useMeshStore.persist.clearStorage();
};
