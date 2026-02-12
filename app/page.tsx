"use client";

import { useEffect, useState } from "react";
import { x25519 } from "@noble/curves/ed25519";
import { useMeshStore } from "../lib/store";
import { NetworkSettings } from "@/components/features/NetworkSettings";
import { GatewaySelection } from "@/components/features/GatewaySelection";
import { NodeTable } from "@/components/features/NodeTable";
import { ClientTable } from "@/components/features/ClientTable";
import { TopologyView } from "@/components/features/TopologyView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/features/DashboardLayout";
import { toast } from "sonner";
import { GeneratePayload } from "@/lib/types";
import { useWireGuardStatus } from "@/hooks/useWireGuardStatus";

function toBase64(arr: Uint8Array) {
  return btoa(String.fromCharCode(...arr));
}

export default function HomePage() {
  const {
    nodes,
    clients,
    networkCidr,
    endpointVersion,
    interfaceName,
    persistentKeepalive,
    includeIpForwarding,
    enableBabel,
    autoGenerateKeys,
    gatewayNodeNames,
    setNetworkCidr,
    setEndpointVersion,
    setInterfaceName,
    setPersistentKeepalive,
    setIncludeIpForwarding,
    setEnableBabel,
    setAutoGenerateKeys,
    setNodes,
    setClients,
    setGatewayNodeNames,
    resetAll,
  } = useMeshStore();

  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "topology">("list");

  // Poll WireGuard Status
  const { status: wgStatus } = useWireGuardStatus(interfaceName);

  // Actions
  const addNode = () => {
    setNodes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Node-${prev.length + 1}`,
        endpoint: "",
        listenPort: 51820 + prev.length,
        publicKey: "",
        privateKey: "",
      },
    ]);
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setGatewayNodeNames((prev) => prev.filter((name) => {
      const node = nodes.find((n) => n.id === id);
      return node ? node.name !== name : true;
    }));
  };

  const updateNode = (id: string, patch: Partial<(typeof nodes)[0]>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n))
    );
  };

  const generateNodeKeys = (id: string) => {
    const priv = x25519.utils.randomPrivateKey();
    const pub = x25519.getPublicKey(priv);
    updateNode(id, {
      privateKey: toBase64(priv),
      publicKey: toBase64(pub),
    });
  };

  const addClient = () => {
    setClients((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Client-${prev.length + 1}`,
        publicKey: "",
        privateKey: "",
      },
    ]);
  };

  const removeClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const updateClient = (id: string, patch: Partial<(typeof clients)[0]>) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const generateClientKeys = (id: string) => {
    const priv = x25519.utils.randomPrivateKey();
    const pub = x25519.getPublicKey(priv);
    updateClient(id, {
      privateKey: toBase64(priv),
      publicKey: toBase64(pub),
    });
  };

  const toggleGateway = (nodeName: string) => {
    setGatewayNodeNames((prev) => {
      if (prev.includes(nodeName)) {
        return prev.filter((n) => n !== nodeName);
      } else {
        return [...prev, nodeName];
      }
    });
  };

  const fillGeneratedKeys = () => {
    nodes.forEach((node) => {
      if (!node.privateKey || !node.publicKey) {
        generateNodeKeys(node.id);
      }
    });
    clients.forEach((client) => {
      if (!client.privateKey || !client.publicKey) {
        generateClientKeys(client.id);
      }
    });
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      // Fill missing keys first if auto-gen is on? 
      // Logic usually implies explicit action or auto-fill before submit.
      // We will send current state.

      const payload: GeneratePayload = {
        networkCidr,
        interfaceName,
        endpointVersion,
        persistentKeepalive,
        includeIpForwarding,
        enableBabel,
        autoGenerateKeys,
        nodes,
        clients,
        gatewayNodeNames,
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Generation failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wireguard-mesh.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Configuration generated successfully!");

    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    if (confirm("All settings will be reset. Are you sure?")) {
      resetAll();
    }
  };

  const sidebarProps = {
    nodesCount: nodes.length,
    clientsCount: clients.length,
    gatewayCount: gatewayNodeNames.length,
    endpointVersion,
    networkCidr,
    persistentKeepalive,
    autoGenerateKeys,
    includeIpForwarding,
    enableBabel,
    gatewayNodeNames,
    busy,
    fillGeneratedKeys,
    handleSubmit,
    resetForm,
  };

  return (
    <DashboardLayout sidebarProps={sidebarProps}>
      <Tabs defaultValue="list" className="w-full h-full flex flex-col" onValueChange={(v) => setViewMode(v as "list" | "topology")}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="topology">Topology</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="flex-1 min-h-0 overflow-y-auto p-1 pb-20 space-y-4">
          {/* 2-Column Grid for Top Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
            <NetworkSettings
              networkCidr={networkCidr}
              setNetworkCidr={setNetworkCidr}
              interfaceName={interfaceName}
              setInterfaceName={setInterfaceName}
              endpointVersion={endpointVersion}
              setEndpointVersion={setEndpointVersion}
              persistentKeepalive={persistentKeepalive}
              setPersistentKeepalive={setPersistentKeepalive}
              includeIpForwarding={includeIpForwarding}
              setIncludeIpForwarding={setIncludeIpForwarding}
              enableBabel={enableBabel}
              setEnableBabel={setEnableBabel}
              autoGenerateKeys={autoGenerateKeys}
              setAutoGenerateKeys={setAutoGenerateKeys}
            />
            <GatewaySelection
              nodeNames={nodes.map(n => n.name)}
              gatewayNodeNames={gatewayNodeNames}
              toggleGateway={toggleGateway}
            />
          </div>

          {/* Nodes Table */}
          <div className="shrink-0">
            <NodeTable
              nodes={nodes}
              status={wgStatus}
              addNode={addNode}
              removeNode={removeNode}
              updateNode={updateNode}
              generateNodeKeys={generateNodeKeys}
              autoGenerateKeys={autoGenerateKeys}
              endpointVersion={endpointVersion}
            />
          </div>

          {/* Clients Table */}
          <div className="shrink-0">
            <ClientTable
              clients={clients}
              status={wgStatus}
              addClient={addClient}
              removeClient={removeClient}
              updateClient={updateClient}
              generateClientKeys={generateClientKeys}
              autoGenerateKeys={autoGenerateKeys}
            />
          </div>
        </TabsContent>

        <TabsContent value="topology" className="flex-1 min-h-0 overflow-hidden">
          <TopologyView nodes={nodes} clients={clients} gatewayNodeNames={gatewayNodeNames} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
