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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GeneratePayload } from "@/lib/types";
import { Globe, RefreshCw, User, Hash, Server, ShieldAlert, Terminal, CheckCircle2, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    mtu,
    setMtu,
    resetAll,
  } = useMeshStore();

  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "topology">("list");
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isRemoteOpen, setIsRemoteOpen] = useState(false);
  const [deployNodeName, setDeployNodeName] = useState("");
  const [remoteLog, setRemoteLog] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [sshPort, setSshPort] = useState(22);

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
        gatewayNodeNames, mtu,
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

  const handleDeploy = () => {
    if (nodes.length === 0) {
      toast.error("Please add at least one node first.");
      return;
    }
    // Pre-select first node if only one
    if (nodes.length === 1) {
      setDeployNodeName(nodes[0].name);
    }
    setIsDeployOpen(true);
  };

  const executeDeploy = async () => {
    if (!deployNodeName) {
      toast.error("Please select a node.");
      return;
    }

    setBusy(true);
    try {
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
        gatewayNodeNames, mtu,
      };

      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, nodeName: deployNodeName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Deployment failed");
      }

      toast.success(`${deployNodeName} successfully installed and activated!`);
      setIsDeployOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Installation error");
    } finally {
      setBusy(false);
    }
  };

  const executeRemoteDeploy = async () => {
    if (!deployNodeName) {
      toast.error("Please select a node.");
      return;
    }

    setBusy(true);
    setRemoteLog(`[Remote Deploy] Starting installation for ${deployNodeName}...\n`);
    try {
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
        gatewayNodeNames, mtu,
      };

      // Find target node and inject SSH credentials temporarily for the API
      const nodesWithSSH = nodes.map(n =>
        n.name === deployNodeName ? { ...n, sshUser, sshPort } : n
      );
      const enrichedPayload = { ...payload, nodes: nodesWithSSH };

      const res = await fetch("/api/deploy/remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: enrichedPayload, nodeName: deployNodeName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRemoteLog((prev) => prev + (data.log || `Error: ${data.error}`));
        throw new Error(data.error || "Remote installation failed");
      }

      setRemoteLog((prev) => prev + (data.log || "Successfully completed."));
      toast.success(`${deployNodeName} successfully installed on remote server!`);
      // Keep dialog open to show logs
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Remote installation error");
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
    gatewayNodeNames,
    busy,
    fillGeneratedKeys,
    handleSubmit,
    handleDeploy,
    handleRemoteDeploy: () => {
      if (nodes.length === 0) {
        toast.error("Please add at least one node first.");
        return;
      }
      if (nodes.length === 1) setDeployNodeName(nodes[0].name);
      setRemoteLog("");
      setIsRemoteOpen(true);
    },
    resetForm,
  };

  return (
    <DashboardLayout sidebarProps={sidebarProps}>
      <Tabs defaultValue="list" className="flex-1 flex flex-col min-h-0" onValueChange={(v) => setViewMode(v as "list" | "topology")}>
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <TabsList className="grid w-[240px] grid-cols-2">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="topology">Topology</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="flex-1 min-h-0 overflow-y-auto p-1 pb-20 space-y-2">
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
              mtu={mtu}
              setMtu={setMtu}
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

      <Dialog open={isDeployOpen} onOpenChange={setIsDeployOpen}>
        <DialogContent className="sm:max-w-[425px] bg-amber-50 backdrop-blur-none! border-primary/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Install on This Server</DialogTitle>
            <DialogDescription>
              Select which node this server represents in the mesh network. This process will overwrite existing WireGuard settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2.5">
              <Label htmlFor="node-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Node Selection
              </Label>
              <Select id="node-select" value={deployNodeName} onChange={(e) => setDeployNodeName(e.target.value)}>
                <option value="" disabled>Select target node...</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.name}>
                    {node.name} {node.endpoint ? `(${node.endpoint})` : "(No endpoint)"}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDeployOpen(false)} disabled={busy} className="hover:bg-destructive/10 hover:text-destructive">
              Cancel
            </Button>
            <Button
              onClick={executeDeploy}
              disabled={busy || !deployNodeName}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 active:scale-95 transition-all px-8"
            >
              {busy ? "Applying..." : "Start Installation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemoteOpen} onOpenChange={setIsRemoteOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col bg-amber-50 backdrop-blur-none! shadow-2xl border-blue-500/70 transition-all">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-xl font-bold">Remote Server Installation (SSH)</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground/80">
              Transfer this node's configuration directly to your remote server via SSH.
              <span className="flex items-center gap-1.5 mt-2 font-medium text-amber-700 bg-amber-100/50 p-2 rounded-md border border-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Important: Passwordless SSH key access must be configured on the target.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 overflow-y-auto pr-2">
            <div className="flex flex-col gap-5 bg-slate-900/5 p-4 rounded-xl border border-border/50">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-1">
                  <Server className="h-3 w-3 text-blue-500" />
                  Target Node Selection
                </Label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  value={deployNodeName}
                  onChange={(e) => setDeployNodeName(e.target.value)}
                >
                  <option value="" disabled>Select target node to begin...</option>
                  {nodes.map((node) => (
                    <option key={`remote-${node.id}`} value={node.name}>
                      {node.name} {node.endpoint ? `(${node.endpoint})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {deployNodeName && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-200/50">
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1">
                      <User className="h-2.5 w-2.5" /> Username
                    </Label>
                    <Input
                      value={sshUser}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSshUser(e.target.value)}
                      placeholder="root"
                      className="h-9 font-mono text-sm bg-background border-border/60 focus:border-blue-500/50"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1">
                      <Hash className="h-2.5 w-2.5" /> Port
                    </Label>
                    <Input
                      type="number"
                      value={sshPort}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSshPort(Number(e.target.value))}
                      className="h-9 font-mono text-sm bg-background border-border/60 focus:border-blue-500/50 text-center"
                    />
                  </div>

                  <div className="md:col-span-5 space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1">
                      <Zap className="h-2.5 w-2.5" /> Connection Target
                    </Label>
                    {(() => {
                      const node = nodes.find(n => n.name === deployNodeName);
                      return (
                        <div className="h-9 flex items-center justify-between px-3 bg-blue-600/10 rounded-lg border border-blue-600/20 text-blue-700 font-mono text-xs font-bold truncate">
                          <span className="opacity-60 text-[9px] uppercase tracking-tighter mr-2 hidden sm:inline">IP:</span>
                          <span className="flex-1 text-center sm:text-right">{node?.endpoint || "Undefined"}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {!deployNodeName && (
                <div className="text-center py-6 text-sm text-blue-600/70 bg-blue-50/50 rounded-lg border border-blue-200/50 border-dashed animate-pulse">
                  Please select a node to configure connection details.
                </div>
              )}
            </div>

            {remoteLog ? (
              <div className="space-y-2.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-0.5">
                  <Terminal className="h-3 w-3" />
                  Deployment Logs
                </Label>
                <div className="text-xs font-mono bg-[#0c0c0c] p-5 rounded-xl border border-slate-800 h-80 overflow-y-auto whitespace-pre-wrap text-emerald-400 shadow-2xl relative group">
                  <div className="sticky top-0 right-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="outline" className="text-[9px] bg-slate-900 border-slate-700 text-slate-400">bash</Badge>
                  </div>
                  {remoteLog}
                  {busy && <span className="animate-pulse ml-1 inline-block w-2 h-4 bg-emerald-500 align-middle shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>}
                </div>
              </div>
            ) : (
              busy && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in zoom-in duration-300">
                  <RefreshCw className="h-10 w-10 text-blue-500 animate-spin" />
                  <p className="text-sm font-medium text-muted-foreground">Preparing configuration...</p>
                </div>
              )
            )}
          </div>

          <DialogFooter className="border-t pt-5 gap-3">
            <Button variant="ghost" onClick={() => setIsRemoteOpen(false)} disabled={busy} className="px-6 hover:bg-slate-100 transition-colors">
              {remoteLog ? "Close" : "Cancel"}
            </Button>
            <Button
              onClick={executeRemoteDeploy}
              disabled={busy || !deployNodeName}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-900/10 min-w-[160px] h-11 transition-all active:scale-95 flex items-center gap-2"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Start Deployment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
