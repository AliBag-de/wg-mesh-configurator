"use client";

import { useEffect, useState, useCallback } from "react";
import { x25519 } from "@noble/curves/ed25519";
import { useMeshStore } from "../lib/store";
import { NetworkSettings } from "@/components/features/NetworkSettings";
import { GatewaySelection } from "@/components/features/GatewaySelection";
import { NodeTable } from "@/components/features/NodeTable";
import { ClientTable } from "@/components/features/ClientTable";
import { TopologyView } from "@/components/features/TopologyView";
import { BatchDeployModal, DeployStatus } from "@/components/features/BatchDeployModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/features/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GeneratePayload } from "@/lib/types";
import {
  Trash2,
  Download,
  Plus,
  Network,
  DownloadCloud,
  Terminal,
  Globe,
  Settings,
  RefreshCw,
  Server,
  User,
  Hash,
  Zap,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
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
import { calculateClientIp, calculateNodeIp } from "@/lib/ip-utils";

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
    reorderNodes,
    reorderClients,
    sshKeys,
    sshHosts,
    setSshHosts
  } = useMeshStore();

  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "topology">("list");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/ssh-hosts")
      .then(res => res.json())
      .then(data => setSshHosts(data.hosts || []))
      .catch(err => console.error("Failed to fetch SSH hosts", err));
  }, []);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isRemoteOpen, setIsRemoteOpen] = useState(false);
  const [deployNodeName, setDeployNodeName] = useState("");
  const [remoteLog, setRemoteLog] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [sshPort, setSshPort] = useState(22);
  const [deployAction, setDeployAction] = useState<"deploy_and_execute" | "deploy" | "execute">("deploy_and_execute");

  // Batch Deploy State
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isBatchDeploying, setIsBatchDeploying] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchNodeStatuses, setBatchNodeStatuses] = useState<Record<string, DeployStatus>>({});
  const [batchLogs, setBatchLogs] = useState("");

  // Sync SSH credentials when node selection or modal opens
  useEffect(() => {
    if (isRemoteOpen && deployNodeName) {
      const node = nodes.find(n => n.name === deployNodeName);
      if (node) {
        setSshUser(node.sshUser || "root");
        setSshPort(node.sshPort || 22);
      }
    }
  }, [isRemoteOpen, deployNodeName, nodes]);

  // Actions
  const addNode = () => {
    setNodes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Node-${prev.length + 1}`,
        endpoint: "",
        listenPort: 51820,
        wgIp: calculateNodeIp(networkCidr, prev.length),
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
        wgIp: calculateClientIp(networkCidr, prev.length),
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

      const node = nodes.find(n => n.name === deployNodeName);
      if (!node) throw new Error("Node not found");

      const nodesWithSSH = nodes.map(n =>
        n.name === deployNodeName ? { ...n, sshUser: sshUser, sshPort: sshPort } : n
      );
      const enrichedPayload = { ...payload, nodes: nodesWithSSH };

      const res = await fetch("/api/deploy/remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: enrichedPayload,
          nodeName: deployNodeName,
          action: deployAction,
          sshKeyContent: Object.values(sshKeys)[0] // Simple: use the first uploaded key for now
        }),
      });

      if (!res.ok) {
        throw new Error("Network error or server unavailable.");
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let eventEndIndex;
          while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
            const eventStr = buffer.slice(0, eventEndIndex);
            buffer = buffer.slice(eventEndIndex + 2);

            if (eventStr.startsWith('data: ')) {
              try {
                const data = JSON.parse(eventStr.slice(6));
                if (data.log) {
                  setRemoteLog((prev) => prev + data.log);
                }
                if (data.status === 'error' || data.error) {
                  throw new Error(data.error || "Remote installation failed");
                }
              } catch (e: any) {
                // Ignore parse errors, handle thrown execution errors
                if (e.message) throw e;
              }
            }
          }
        }
        toast.success(`${deployNodeName} successfully installed on remote server!`);
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Remote installation error");
    } finally {
      setBusy(false);
    }
  };

  const executeBatchRemoteDeploy = async () => {
    const eligibleNodes = nodes.filter(n => n.sshUser && n.sshPort && (n.sshHost || n.endpoint));
    if (eligibleNodes.length === 0) {
      toast.error("No nodes configured with SSH details found.");
      return;
    }

    setIsBatchDeploying(true);
    setBatchLogs("");
    setBatchProgress(1); // Start at 1% for visual cue

    // Initial statuses
    const newStatuses = { ...batchNodeStatuses };
    eligibleNodes.forEach(n => {
      if (!newStatuses[n.id] || newStatuses[n.id] === "error") {
        newStatuses[n.id] = "pending";
      }
    });
    setBatchNodeStatuses(newStatuses);

    let completed = Object.values(newStatuses).filter(s => s === "success").length;

    for (const node of eligibleNodes) {
      if (newStatuses[node.id] === "success") continue;

      setBatchNodeStatuses(prev => ({ ...prev, [node.id]: "deploying" }));
      setBatchLogs(prev => prev + `\n>>> [${new Date().toLocaleTimeString()}] Starting: ${node.name}...\n`);

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
          gatewayNodeNames,
          mtu,
        };

        const res = await fetch("/api/deploy/remote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload,
            nodeName: node.name,
            sshKeyContent: Object.values(sshKeys)[0] // Simple: use the first uploaded key for now
          }),
        });

        if (!res.ok) throw new Error("Server error");

        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let nodeSuccess = true;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let eventEndIndex;
            while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
              const eventStr = buffer.slice(0, eventEndIndex);
              buffer = buffer.slice(eventEndIndex + 2);

              if (eventStr.startsWith('data: ')) {
                try {
                  const data = JSON.parse(eventStr.slice(6));
                  if (data.log) {
                    setBatchLogs((prev) => prev + data.log);
                  }
                  if (data.status === 'error' || data.error) {
                    nodeSuccess = false;
                    throw new Error(data.error || "Deployment failed");
                  }
                } catch (e: any) {
                  if (e.message) throw e;
                }
              }
            }
          }

          if (nodeSuccess) {
            setBatchNodeStatuses(prev => ({ ...prev, [node.id]: "success" }));
            setBatchLogs(prev => prev + `[SUCCESS] ${node.name} completed successfully.\n`);
            completed++;
          }
        }

      } catch (err: any) {
        setBatchNodeStatuses(prev => ({ ...prev, [node.id]: "error" }));
        setBatchLogs(prev => prev + `[FATAL] ${node.name}: ${err.message}\n`);
      }

      setBatchProgress(((completed) / eligibleNodes.length) * 100);
    }

    setIsBatchDeploying(false);
    if (completed === eligibleNodes.length) {
      toast.success("Batch deployment finished successfully!");
    } else {
      toast.warning("Batch deployment finished with some errors.");
    }
  };

  const resetForm = () => {
    resetAll();
    toast.success("Settings have been reset.");
  };

  const sidebarProps = {
    nodesCount: nodes.length,
    clientsCount: clients.length,
    gatewayCount: gatewayNodeNames.length,
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
    handleBatchRemoteDeploy: () => {
      if (nodes.length === 0) {
        toast.error("Please add at least one node first.");
        return;
      }
      const eligible = nodes.filter(n => n.sshUser && n.sshPort && (n.sshHost || n.endpoint));
      if (eligible.length === 0) {
        toast.error("Please configure SSH User, Port and Host for at least one node.");
        return;
      }
      setIsBatchOpen(true);
    },
    resetForm,
  };

  if (!isMounted) {
    return null;
  }

  return (
    <DashboardLayout sidebarProps={sidebarProps}>
      {/* Background glow effects for the main content area */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex justify-center z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="max-w-[1600px] w-full mx-auto space-y-2 relative z-10 flex flex-col h-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between shrink-0 border-b border-border/40 pb-2 pt-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-white">
              <Network className="h-8 w-8 text-primary drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              WG Mesh <span className="text-primary font-light">Configurator</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm font-medium tracking-wide">
              Secure overlay network orchestration and deployment
            </p>
          </div>
        </div>

        <Tabs defaultValue="list" className="flex-1 flex flex-col min-h-0 space-y-2" onValueChange={(v) => setViewMode(v as "list" | "topology")}>
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-xl font-bold tracking-tight text-white/90">Dashboard Overview</h2>
            <TabsList className="grid w-[240px] grid-cols-2 bg-black/40 border border-border/50">
              <TabsTrigger value="list" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">List View</TabsTrigger>
              <TabsTrigger value="topology" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Topology</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="flex-1 min-h-0 overflow-y-auto pr-2 pb-20 space-y-6 custom-scrollbar focus-visible:outline-none">
            {/* 2-Column Grid for Top Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0">
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
                nodeNames={nodes.map((n) => n.name)}
                gatewayNodeNames={gatewayNodeNames}
                toggleGateway={toggleGateway}
              />
            </div>

            {/* Tables */}
            <div className="space-y-6 shrink-0">
              <NodeTable
                nodes={nodes}
                addNode={addNode}
                removeNode={removeNode}
                updateNode={updateNode}
                generateNodeKeys={generateNodeKeys}
                reorderNodes={reorderNodes}
                autoGenerateKeys={autoGenerateKeys}
                endpointVersion={endpointVersion}
                sshHosts={sshHosts}
              />

              <ClientTable
                clients={clients}
                addClient={addClient}
                removeClient={removeClient}
                updateClient={updateClient}
                generateClientKeys={generateClientKeys}
                reorderClients={reorderClients}
                autoGenerateKeys={autoGenerateKeys}
              />
            </div>
          </TabsContent>

          <TabsContent value="topology" className="flex-1 min-h-0 border rounded-xl overflow-hidden bg-black/20 backdrop-blur-md shadow-xl border-border/40 focus-visible:outline-none">
            <TopologyView nodes={nodes} clients={clients} gatewayNodeNames={gatewayNodeNames} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isDeployOpen} onOpenChange={setIsDeployOpen}>
        <DialogContent className="sm:max-w-[480px] bg-background/95 backdrop-blur-2xl shadow-2xl border-primary/30 transition-all rounded-xl p-0 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          <div className="p-6 pb-2 relative z-10">
            <DialogHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <DialogTitle className="text-xl font-bold tracking-tight">Host Instance Setup</DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground/80 mt-1">
                Designate this server's identity within the mesh network. Existing WireGuard configurations will be re-synchronized.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-4 flex flex-col gap-6">
            <div className="space-y-3 p-5 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm shadow-inner">
              <Label htmlFor="node-select" className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 ml-1">
                <Server className="h-3.5 w-3.5" /> Identity Selection
              </Label>
              <select
                id="node-select"
                className="w-full h-11 px-4 rounded-lg border border-border/50 bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-medium text-foreground hover:bg-secondary/70 appearance-none"
                value={deployNodeName}
                onChange={(e) => setDeployNodeName(e.target.value)}
              >
                <option value="" disabled className="bg-background text-muted-foreground">Select local node identity...</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.name} className="bg-background text-foreground">
                    {node.name} {node.endpoint ? `(${node.endpoint})` : "(No endpoint)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-200/60 leading-relaxed shadow-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-400" />
              <span>This action will perform a local deployment. Ensure you are running this on the actual hardware designated above.</span>
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-card/40 flex-row justify-end space-x-3 sm:space-x-4">
            <Button variant="outline" onClick={() => setIsDeployOpen(false)} disabled={busy} className="px-6 border-border/60 hover:bg-secondary transition-colors">
              Cancel
            </Button>
            <Button
              onClick={executeDeploy}
              disabled={busy || !deployNodeName}
              className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] min-w-[160px] h-10 transition-all duration-300 active:scale-95 flex items-center gap-2"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin opacity-80" />
                  Applying...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-white" />
                  Activate Mesh
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemoteOpen} onOpenChange={setIsRemoteOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col bg-background/95 backdrop-blur-2xl shadow-2xl border-primary/30 transition-all rounded-xl overflow-hidden p-0">
          <div className="p-6 pb-2 relative z-10">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            <DialogHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <DialogTitle className="text-xl font-bold tracking-tight">Remote Server Connection</DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground/80">
                Transfer this node's configuration directly to your remote server via SSH.
                <span className="flex items-center gap-1.5 mt-3 text-xs font-medium text-amber-500/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Passwordless SSH key access must be pre-configured on the target.
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-2 overflow-y-auto min-h-[100px] max-h-[60vh] custom-scrollbar">
            <div className="flex flex-col gap-5 p-5 mb-4 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm shadow-inner">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 ml-1">
                  <Server className="h-3.5 w-3.5" />
                  Target Node
                </Label>
                <select
                  className="w-full h-11 px-4 rounded-lg border border-border/50 bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-medium text-foreground hover:bg-secondary/70 appearance-none"
                  value={deployNodeName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setDeployNodeName(name);
                    // Pre-fill from node data
                    const node = nodes.find(n => n.name === name);
                    if (node) {
                      if (node.sshUser) setSshUser(node.sshUser);
                      if (node.sshPort) setSshPort(node.sshPort);
                      else if (!node.sshPort) setSshPort(22); // Default to 22 if not set
                    }
                  }}
                >
                  <option value="" disabled className="bg-background text-muted-foreground">Select a node to begin...</option>
                  {nodes.map((node) => (
                    <option key={`remote-${node.id}`} value={node.name} className="bg-background text-foreground">
                      {node.name} {node.endpoint ? `(${node.endpoint})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {deployNodeName && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-border/40">
                  <div className="md:col-span-4 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1 font-semibold">
                      <User className="h-3 w-3 text-primary/70" /> User
                    </Label>
                    <Input
                      value={sshUser}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSshUser(e.target.value)}
                      placeholder="root"
                      className="h-10 font-mono text-sm shadow-sm"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1 font-semibold">
                      <Hash className="h-3 w-3 text-primary/70" /> Port
                    </Label>
                    <Input
                      type="number"
                      value={sshPort}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSshPort(Number(e.target.value))}
                      className="h-10 font-mono text-sm shadow-sm text-center"
                    />
                  </div>

                  <div className="md:col-span-5 space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1 font-semibold">
                      <Zap className="h-3 w-3 text-primary/70" /> Connection Host
                    </Label>
                    {(() => {
                      const node = nodes.find(n => n.name === deployNodeName);
                      return (
                        <div className="h-10 flex items-center justify-between px-4 bg-primary/10 rounded-lg border border-primary/20 text-primary font-mono text-xs font-bold truncate shadow-inner">
                          <span className="opacity-70 text-[10px] uppercase tracking-wider mr-2 hidden sm:inline">URL:</span>
                          <span className="flex-1 text-center sm:text-right text-primary-foreground">{node?.sshHost || node?.endpoint || "Undefined"}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {deployNodeName && (
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1 font-semibold">
                    <Settings className="h-3 w-3 text-primary/70" /> Deployment Action
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setDeployAction("deploy_and_execute")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                        deployAction === "deploy_and_execute"
                          ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                          : "bg-black/20 border-border/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <Zap className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Full Setup</span>
                    </button>
                    <button
                      onClick={() => setDeployAction("deploy")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                        deployAction === "deploy"
                          ? "bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                          : "bg-black/20 border-border/40 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5"
                      )}
                    >
                      <DownloadCloud className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Upload Only</span>
                    </button>
                    <button
                      onClick={() => setDeployAction("execute")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                        deployAction === "execute"
                          ? "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                          : "bg-black/20 border-border/40 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/5"
                      )}
                    >
                      <Terminal className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Execute Setup</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic px-1 pt-1">
                    {deployAction === "deploy_and_execute" && "Upload configuration files and immediately initiate the WireGuard setup script."}
                    {deployAction === "deploy" && "Only transfer configuration files to the remote server's temporary directory."}
                    {deployAction === "execute" && "Initiate the setup script and verification process for already uploaded files."}
                  </p>
                </div>
              )}

              {!deployNodeName && (
                <div className="text-center py-5 text-sm font-medium text-muted-foreground/70 bg-black/20 rounded-lg border border-border/40 border-dashed animate-pulse">
                  Please select a node to configure connection details.
                </div>
              )}
            </div>

            {remoteLog ? (
              <div className="space-y-3 mb-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2 ml-1">
                  <Terminal className="h-3.5 w-3.5" />
                  Execution Logs
                </Label>
                <div className="text-[13px] leading-relaxed font-mono bg-[#050505] p-5 rounded-xl border border-[#333] h-[320px] overflow-y-auto whitespace-pre-wrap text-emerald-400 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] relative group custom-scrollbar">
                  <div className="sticky top-0 right-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest bg-emerald-950/40 border-emerald-800 text-emerald-500 backdrop-blur-sm">Sysout</Badge>
                  </div>
                  {remoteLog}
                  {busy && <span className="animate-pulse ml-1 inline-block w-2.5 h-4 bg-emerald-400 align-middle shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
                </div>
              </div>
            ) : (
              busy && (
                <div className="flex flex-col items-center justify-center py-16 gap-5 animate-in fade-in zoom-in duration-300">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                    <RefreshCw className="h-12 w-12 text-primary animate-spin relative z-10" />
                  </div>
                  <p className="text-sm font-semibold tracking-wide text-primary animate-pulse">Establishing Secure Connection...</p>
                </div>
              )
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-card/40 flex-row justify-end space-x-3 sm:space-x-4">
            <Button variant="outline" onClick={() => setIsRemoteOpen(false)} disabled={busy} className="px-6 border-border/60 hover:bg-secondary transition-colors">
              {remoteLog && !busy ? "Close Window" : "Cancel"}
            </Button>
            <Button
              onClick={executeRemoteDeploy}
              disabled={busy || !deployNodeName}
              className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] min-w-[180px] h-10 transition-all duration-300 active:scale-95 flex items-center gap-2"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin opacity-80" />
                  Deploying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {deployAction === "execute" ? "Run Setup Script" : "Initiate Deploy"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchDeployModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        nodes={nodes}
        isDeploying={isBatchDeploying}
        currentProgress={batchProgress}
        nodeStatuses={batchNodeStatuses}
        logs={batchLogs}
        onStart={executeBatchRemoteDeploy}
      />
    </DashboardLayout>
  );
}
