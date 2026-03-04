import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ClientInput, EndpointVersion, NodeInput, TopologyType } from "./types";
import { Peer } from "./provisioning/contracts";

type MeshState = {
  networkCidr: string;
  endpointVersion: EndpointVersion;
  interfaceName: string;
  persistentKeepalive: number;
  includeIpForwarding: boolean;
  enableBabel: boolean;
  autoGenerateKeys: boolean;
  topology: TopologyType;
  nodes: NodeInput[];
  clients: ClientInput[];
  mtu: number;
  sshHosts: any[];
  sshKeys: Record<string, string>;
  provisioningState: {
    selectedInterface: string | null;
    draftPeers: Record<string, Peer[]>;
  };
  setNetworkCidr: (value: string) => void;
  setEndpointVersion: (value: EndpointVersion) => void;
  setInterfaceName: (value: string) => void;
  setPersistentKeepalive: (value: number) => void;
  setIncludeIpForwarding: (value: boolean) => void;
  setEnableBabel: (value: boolean) => void;
  setAutoGenerateKeys: (value: boolean) => void;
  setTopology: (value: TopologyType) => void;
  setNodes: (value: NodeInput[] | ((prev: NodeInput[]) => NodeInput[])) => void;
  setClients: (
    value: ClientInput[] | ((prev: ClientInput[]) => ClientInput[])
  ) => void;
  setMtu: (value: number) => void;
  setSshHosts: (value: any[]) => void;
  setSshKeys: (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setProvisioningState: (value: Partial<{ selectedInterface: string | null; draftPeers: Record<string, Peer[]> }>) => void;
  reorderNodes: (newNodes: NodeInput[]) => void;
  reorderClients: (newClients: ClientInput[]) => void;
  resetAll: () => void;
  importMeshState: (data: Partial<MeshState>) => void;
  ensureKeys: () => void;
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
  presharedKey: "",
  gateways: [],
  subnetRoutes: ""
});

const defaultState = () => ({
  networkCidr: "10.20.0.0/24",
  endpointVersion: "ipv6" as EndpointVersion,
  interfaceName: "wg0",
  persistentKeepalive: 25,
  includeIpForwarding: true,
  enableBabel: true,
  autoGenerateKeys: true,
  topology: "full_mesh" as TopologyType,
  nodes: [],
  clients: [],
  mtu: 1420,
  sshHosts: [],
  sshKeys: {},
  provisioningState: {
    selectedInterface: null,
    draftPeers: {}
  }
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
      setTopology: (value) => set({ topology: value }),
      setNodes: (value) =>
        set((state) => ({
          nodes: typeof value === "function" ? value(state.nodes) : value
        })),
      setClients: (value) =>
        set((state) => ({
          clients: typeof value === "function" ? value(state.clients) : value
        })),
      setMtu: (value) => set({ mtu: value }),
      setSshHosts: (value) => set({ sshHosts: value }),
      setSshKeys: (value) => set((state) => ({
        sshKeys: typeof value === "function" ? value(state.sshKeys) : value
      })),
      setProvisioningState: (value) => set((state) => ({
        provisioningState: { ...state.provisioningState, ...value }
      })),
      reorderNodes: (newNodes) => set({ nodes: newNodes }),
      reorderClients: (newClients) => set({ clients: newClients }),
      resetAll: () => set(defaultState()),
      importMeshState: (data) => {
        // Only keep fields that exist in defaultState
        const defaults = defaultState();
        const filteredData: any = {};
        for (const key in defaults) {
          if (data.hasOwnProperty(key)) {
            filteredData[key] = (data as any)[key];
          }
        }
        set(filteredData);
      },
      ensureKeys: () => {
        set((state) => {
          let updated = false;

          const newNodes = state.nodes.map(node => {
            if (!node.privateKey || !node.publicKey) {
              updated = true;
              const { generateKeypair } = require('./wg-utils');
              const keypair = generateKeypair();
              return { ...node, privateKey: keypair.privateKey, publicKey: keypair.publicKey };
            }
            return node;
          });

          const newClients = state.clients.map(client => {
            if (!client.privateKey || !client.publicKey) {
              updated = true;
              const { generateKeypair } = require('./wg-utils');
              const keypair = generateKeypair();
              return { ...client, privateKey: keypair.privateKey, publicKey: keypair.publicKey };
            }
            return client;
          });

          if (updated) {
            return { nodes: newNodes, clients: newClients };
          }
          return state;
        });
      }
    }),
    {
      name: "wg-mesh-config",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        networkCidr: state.networkCidr,
        endpointVersion: state.endpointVersion,
        interfaceName: state.interfaceName,
        persistentKeepalive: state.persistentKeepalive,
        includeIpForwarding: state.includeIpForwarding,
        enableBabel: state.enableBabel,
        autoGenerateKeys: state.autoGenerateKeys,
        topology: state.topology,
        nodes: state.nodes,
        clients: state.clients,
        mtu: state.mtu,
        provisioningState: state.provisioningState
        // sshHosts and sshKeys are EXCLUDED here for security (no persistence)
      })
    }
  )
);

export const clearMeshStorage = () => {
  useMeshStore.persist.clearStorage();
};
