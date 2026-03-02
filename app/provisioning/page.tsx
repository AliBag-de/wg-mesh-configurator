"use client";

import { Badge } from "@/components/ui/badge";

import { useMeshStore } from "@/lib/store";
import { ProvisioningPanel } from "@/components/features/ProvisioningPanel";
import { DashboardLayout } from "@/components/features/DashboardLayout";
import { BatchDeployModal, DeployStatus } from "@/components/features/BatchDeployModal";
import { x25519 } from "@noble/curves/ed25519";
import { GeneratePayload } from "@/lib/types";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Terminal,
    ShieldAlert,
    Globe,
    Zap,
    RefreshCw,
    Server,
    User,
    Hash,
    Settings,
    CheckCircle2,
    ShieldCheck,
    AlertCircle,
    DownloadCloud
} from "lucide-react";

function toBase64(arr: Uint8Array) {
    return btoa(String.fromCharCode(...arr));
}

export default function ProvisioningPage() {
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
        topology,
        mtu,
        setNodes,
        setClients,
        resetAll,
        sshKeys,
        sshHosts,
        setSshHosts
    } = useMeshStore();

    const [busy, setBusy] = useState(false);
    const [isRemoteOpen, setIsRemoteOpen] = useState(false);
    const [deployNodeName, setDeployNodeName] = useState("");
    const [remoteLog, setRemoteLog] = useState("");
    const [sshUser, setSshUser] = useState("root");
    const [sshPort, setSshPort] = useState(22);
    const [deployAction, setDeployAction] = useState<"deploy_and_execute" | "deploy" | "execute">("deploy_and_execute");

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

    // Batch Deploy State
    const [isBatchOpen, setIsBatchOpen] = useState(false);
    const [isBatchDeploying, setIsBatchDeploying] = useState(false);
    const [batchProgress, setBatchProgress] = useState(0);
    const [batchNodeStatuses, setBatchNodeStatuses] = useState<Record<string, DeployStatus>>({});
    const [batchLogs, setBatchLogs] = useState("");

    useEffect(() => {
        fetch("/api/ssh-hosts")
            .then(res => res.json())
            .then(data => setSshHosts(data.hosts || []))
            .catch(err => console.error("Failed to fetch SSH hosts", err));
    }, []);

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
            const payload: GeneratePayload = {
                networkCidr,
                interfaceName,
                endpointVersion,
                persistentKeepalive,
                includeIpForwarding,
                enableBabel,
                autoGenerateKeys,
                topology,
                nodes,
                clients,
                gatewayNodeNames,
                mtu
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

    const executeRemoteDeploy = async () => {
        if (!deployNodeName) return;
        setBusy(true);
        setRemoteLog("");

        try {
            const payload: GeneratePayload = {
                networkCidr,
                interfaceName,
                endpointVersion,
                persistentKeepalive,
                includeIpForwarding,
                enableBabel,
                autoGenerateKeys,
                topology,
                nodes,
                clients,
                gatewayNodeNames,
                mtu,
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
                    sshKeyContent: Object.values(sshKeys)[0]
                }),
            });

            if (!res.body) throw new Error("No response body");

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
                            if (data.log) setRemoteLog(prev => prev + data.log);
                            if (data.status === 'error' || data.error) throw new Error(data.error || "Remote installation failed");
                        } catch (e: any) {
                            if (e.message) throw e;
                        }
                    }
                }
            }
            toast.success(`${deployNodeName} successfully installed!`);
        } catch (err: any) {
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
        setBatchProgress(1);

        const newStatuses = { ...batchNodeStatuses };
        eligibleNodes.forEach(n => {
            if (!newStatuses[n.id] || newStatuses[n.id] === "error") {
                newStatuses[n.id] = "pending";
            }
        });
        // --- STAGE 0: SYNC MISSING KEYS BEFORE DEPLOYING ---
        let hasMissingKeys = false;
        nodes.forEach(n => {
            if (!n.privateKey) {
                generateNodeKeys(n.id);
                hasMissingKeys = true;
            }
        });

        clients.forEach(c => {
            if (!c.privateKey) {
                generateClientKeys(c.id);
                hasMissingKeys = true;
            }
        });

        if (hasMissingKeys) {
            const updatedNodes = nodes.map(n => {
                if (n.privateKey) return n;
                const priv = x25519.utils.randomPrivateKey();
                return { ...n, privateKey: toBase64(priv), publicKey: toBase64(x25519.getPublicKey(priv)) };
            });
            const updatedClients = clients.map(c => {
                if (c.privateKey) return c;
                const priv = x25519.utils.randomPrivateKey();
                return { ...c, privateKey: toBase64(priv), publicKey: toBase64(x25519.getPublicKey(priv)) };
            });

            updatedNodes.forEach(n => {
                if (!nodes.find(o => o.id === n.id)?.privateKey) {
                    updateNode(n.id, { privateKey: n.privateKey, publicKey: n.publicKey });
                }
            });
            updatedClients.forEach(c => {
                if (!clients.find(o => o.id === c.id)?.privateKey) {
                    updateClient(c.id, { privateKey: c.privateKey, publicKey: c.publicKey });
                }
            });

            setTimeout(() => __executeLoop(updatedNodes, updatedClients), 100);
            return;
        }

        __executeLoop(nodes, clients);
    };

    const __executeLoop = async (currentNodes: typeof nodes, currentClients: typeof clients) => {
        const eligibleNodes = currentNodes.filter(n => n.sshUser && n.sshPort && (n.sshHost || n.endpoint));
        let completed = Object.values(batchNodeStatuses).filter(s => s === "success").length;

        for (const node of eligibleNodes) {
            if (batchNodeStatuses[node.id] === "success") continue;
            setBatchNodeStatuses(prev => ({ ...prev, [node.id]: "deploying" }));
            setBatchLogs(prev => prev + `\n>>> [${new Date().toLocaleTimeString()}] Starting: ${node.name}...\n`);

            try {
                const payload: GeneratePayload = {
                    networkCidr, interfaceName, endpointVersion, persistentKeepalive,
                    includeIpForwarding, enableBabel, autoGenerateKeys, topology, nodes: currentNodes, clients: currentClients, gatewayNodeNames, mtu
                };

                const res = await fetch("/api/deploy/remote", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        payload,
                        nodeName: node.name,
                        action: deployAction,
                        sshKeyContent: Object.values(sshKeys)[0]
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
                                const data = JSON.parse(eventStr.slice(6));
                                if (data.log) setBatchLogs(prev => prev + data.log);
                                if (data.status === 'error' || data.error) {
                                    nodeSuccess = false;
                                    break;
                                }
                            }
                        }
                    }
                    if (nodeSuccess) {
                        setBatchNodeStatuses(prev => ({ ...prev, [node.id]: "success" }));
                        setBatchLogs(prev => prev + `\nOK: ${node.name} completed.\n`);
                    } else {
                        throw new Error("Node deployment failed");
                    }
                }
            } catch (err: any) {
                setBatchNodeStatuses(prev => ({ ...prev, [node.id]: "error" }));
                setBatchLogs(prev => prev + `\nERROR: ${node.name} - ${err.message}\n`);
            }
            const currentTotal = Object.values(batchNodeStatuses).length;
            const currentDone = Object.values(batchNodeStatuses).filter(s => s === "success" || s === "error").length;
            setBatchProgress(Math.round((currentDone / currentTotal) * 100));
        }
        setIsBatchDeploying(false);
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
        gatewayNodeNames,
        busy,
        fillGeneratedKeys,
        handleSubmit,
        handleRemoteDeploy: () => {
            if (nodes.length === 0) {
                toast.error("Add at least one node first.");
                return;
            }
            setDeployNodeName(nodes[0].name);
            setIsRemoteOpen(true);
        },
        handleBatchRemoteDeploy: () => {
            const eligible = nodes.filter(n => n.sshUser && n.sshPort && (n.sshHost || n.endpoint));
            if (eligible.length === 0) {
                toast.error("No nodes with SSH configured.");
                return;
            }
            setIsBatchOpen(true);
        },
        resetForm,
    };

    return (
        <DashboardLayout sidebarProps={sidebarProps}>
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <h2 className="text-2xl font-bold tracking-tight">Provisioning Dashboard</h2>
                </div>
                <div className="flex-1 min-h-0">
                    <ProvisioningPanel />
                </div>
            </div>

            {/* Remote Deploy Modal */}
            <Dialog open={isRemoteOpen} onOpenChange={setIsRemoteOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col bg-background/95 backdrop-blur-2xl shadow-2xl border-primary/30 transition-all rounded-xl overflow-hidden p-0">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                    <div className="p-6 pb-2 relative z-10">
                        <DialogHeader className="border-b border-border/50 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Globe className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <DialogTitle className="text-xl font-bold tracking-tight">Remote Server Connection</DialogTitle>
                            </div>
                            <DialogDescription className="text-muted-foreground/80">
                                Deploy configuration and install WireGuard/Babel on the remote server.
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
                                    onChange={(e) => setDeployNodeName(e.target.value)}
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
                                            onChange={(e) => setSshUser(e.target.value)}
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
                                            onChange={(e) => setSshPort(Number(e.target.value))}
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
                                    <p className="text-[10px] text-muted-foreground italic px-1 pt-1 opacity-70">
                                        {deployAction === "deploy_and_execute" && "Upload configuration files and immediately initiate the WireGuard setup script."}
                                        {deployAction === "deploy" && "Only transfer configuration files to the remote server's temporary directory."}
                                        {deployAction === "execute" && "Initiate the setup script and verification process for already uploaded files."}
                                    </p>
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

            {/* Batch Deploy Modal */}
            <BatchDeployModal
                isOpen={isBatchOpen}
                onClose={() => setIsBatchOpen(false)}
                nodes={nodes}
                nodeStatuses={batchNodeStatuses}
                currentProgress={batchProgress}
                isDeploying={isBatchDeploying}
                onStart={executeBatchRemoteDeploy}
                logs={batchLogs}
                deployAction={deployAction}
                setDeployAction={setDeployAction}
            />
        </DashboardLayout>
    );
}
