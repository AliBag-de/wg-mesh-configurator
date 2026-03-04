"use client";

import { cn } from "@/lib/utils";
import { parseWgConfig, convertConfigToMesh } from "@/lib/import";
import { useRef } from "react";
import { useMeshStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, LayoutDashboard, RefreshCw, Zap, Server, Network, Shield, Upload, ChevronDown, ChevronRight, Hash, Trash2, Files } from "lucide-react";
import { EndpointVersion } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { NodeInput, ClientInput } from "@/lib/types";
import { ConfigManager } from "./ConfigManager";
import { SSHConfigManager } from "./SSHConfigManager";

interface SidebarProps {
    nodesCount: number;
    clientsCount: number;
    busy: boolean;
    fillGeneratedKeys: () => void;
    handleSubmit: () => void;
    handleDeploy?: () => void;
    handleRemoteDeploy?: () => void;
    handleBatchRemoteDeploy?: () => void;
    resetForm: () => void;
    className?: string;
}

export function Sidebar({
    nodesCount,
    clientsCount,
    busy,
    fillGeneratedKeys,
    handleSubmit,
    handleDeploy,
    handleRemoteDeploy,
    handleBatchRemoteDeploy,
    resetForm,
    className,
}: SidebarProps) {
    const { nodes, clients, setNodes, setClients } = useMeshStore();
    const pathname = usePathname();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        ssh: true,
        scripts: true
    });

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [pendingImportData, setPendingImportData] = useState<{ nodes: NodeInput[], clients: ClientInput[] } | null>(null);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const config = parseWgConfig(text);
            const data = convertConfigToMesh(config, nodes, clients);

            if (data.nodes.length > 0 || data.clients.length > 0) {
                if (nodes.length > 0 || clients.length > 0) {
                    setPendingImportData(data);
                    setIsImportDialogOpen(true);
                } else {
                    // Empty list, just import directly
                    setNodes(data.nodes);
                    setClients(data.clients);
                }
            } else {
                alert("No new unique nodes or clients found in this configuration.");
            }
        } catch (err) {
            console.error("Import failed:", err);
            alert("Failed to parse configuration file.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const confirmImport = (strategy: 'append' | 'overwrite') => {
        if (!pendingImportData) return;

        if (strategy === 'overwrite') {
            setNodes(pendingImportData.nodes);
            setClients(pendingImportData.clients);
        } else {
            setNodes((prev) => [...prev, ...pendingImportData.nodes]);
            setClients((prev) => [...prev, ...pendingImportData.clients]);
        }

        setIsImportDialogOpen(false);
        setPendingImportData(null);
    };

    return (
        <aside className={cn("flex flex-col h-screen border-r bg-card/50 backdrop-blur-xl", className)}>
            {/* Logo / Header */}
            <div className="p-4 border-b border-border/50">
                <div className="flex items-center gap-2 mb-0.5">
                    <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                        <Network className="h-4 w-4" />
                    </div>
                    <h1 className="font-bold text-base tracking-tight">Mesh Config</h1>
                </div>
                <p className="text-[10px] text-muted-foreground ml-9">WireGuard Topology Gen</p>
            </div>

            {/* Navigation */}
            <div className="px-4 pt-4 space-y-1">
                <Link href="/" className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                    <LayoutDashboard className="h-4 w-4" />
                    Generator
                </Link>
                <Link href="/provisioning" className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname === "/provisioning" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                    <Server className="h-4 w-4" />
                    Provisioning
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="p-2 grid grid-cols-2 gap-3">
                <div className="flex flex-col p-1 rounded-lg bg-secondary/30 border border-secondary/50 content-center items-center justify-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Nodes</div>
                    <div className="text-2xl font-bold font-mono">{nodesCount}</div>
                </div>
                <div className="flex flex-col p-1 rounded-lg bg-secondary/30 border border-secondary/50 content-center items-center justify-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Clients</div>
                    <div className="text-2xl font-bold font-mono text-blue-400">{clientsCount}</div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-4">
                <div className="space-y-1">
                    <button
                        onClick={() => toggleSection('ssh')}
                        className={cn(
                            "w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest px-2 py-2 rounded-md transition-all",
                            expandedSections.ssh ? "bg-blue-500/10 text-blue-400" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5" />
                            SSH Credentials
                        </div>
                        {expandedSections.ssh ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    {expandedSections.ssh && (
                        <div className="pl-2 pr-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            <SSHConfigManager />
                        </div>
                    )}
                </div>

                {/* Backup & Restore Section */}
                <div className="space-y-1">
                    <button
                        onClick={() => toggleSection('backup')}
                        className={cn(
                            "w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest px-2 py-2 rounded-md transition-all",
                            expandedSections.backup ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Config Backup
                        </div>
                        {expandedSections.backup ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    {expandedSections.backup && (
                        <div className="pl-2 pr-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            <ConfigManager />
                        </div>
                    )}
                </div>
            </div >

            {/* Actions Footer */}
            < div className="p-3 border-t border-border/50 bg-background/50 space-y-2 shrink-0" >
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        className="font-semibold shadow-md shadow-primary/10 h-8 text-[11px] px-2"
                        size="sm"
                        onClick={fillGeneratedKeys}
                        disabled={busy}
                    >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        Generate
                    </Button>

                    <Button
                        variant="outline"
                        className="h-8 text-[11px] px-2"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                    >
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        Import
                    </Button>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".conf,.txt"
                    onChange={handleFileImport}
                />

                <Button
                    variant="secondary"
                    className="w-full h-8 text-xs font-medium"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={busy}
                >
                    <Download className="mr-2 h-4 w-4" />
                    {busy ? "Downloading..." : "Download Zip"}
                </Button>

                {
                    (handleRemoteDeploy || handleDeploy) && (
                        <div className="grid grid-cols-1 gap-1.5">
                            {handleRemoteDeploy && (
                                <Button
                                    variant="default"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 h-8 text-xs"
                                    size="sm"
                                    onClick={handleRemoteDeploy}
                                    disabled={busy}
                                >
                                    <Server className="mr-2 h-3.5 w-3.5" />
                                    Deploy to Remote
                                </Button>
                            )}
                            {handleBatchRemoteDeploy && (
                                <Button
                                    variant="default"
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10 h-8 text-xs"
                                    size="sm"
                                    onClick={handleBatchRemoteDeploy}
                                    disabled={busy}
                                >
                                    <Files className="mr-2 h-3.5 w-3.5" />
                                    Deploy to All Remote
                                </Button>
                            )}
                            {handleDeploy && (
                                <Button
                                    variant="default"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10 h-8 text-xs"
                                    size="sm"
                                    onClick={handleDeploy}
                                    disabled={busy}
                                >
                                    <Zap className="mr-2 h-3.5 w-3.5" />
                                    Activate on Host
                                </Button>
                            )}
                        </div>
                    )
                }

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30 mt-1">
                    <Button
                        variant="ghost"
                        className="flex-1 text-muted-foreground hover:text-destructive text-[10px] h-7 px-0"
                        onClick={resetForm}
                        disabled={busy}
                    >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Reset All
                    </Button>
                    <div className="text-[9px] text-muted-foreground/60 font-mono italic">
                        v0.1.0 rev.A
                    </div>
                </div>
            </div >

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-amber-50 backdrop-blur-none! border-primary/60 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-primary" />
                            Import Strategy
                        </DialogTitle>
                        <DialogDescription>
                            Your workspace is not empty. How would you like to import the new configuration?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-start gap-1 p-4 hover:bg-emerald-50 hover:border-emerald-500/50"
                                onClick={() => confirmImport('append')}
                            >
                                <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                                    <ChevronRight className="h-4 w-4" /> Append to Current
                                </span>
                                <span className="text-[10px] text-muted-foreground text-left">
                                    Add {pendingImportData?.nodes.length} nodes and {pendingImportData?.clients.length} clients to the end of your existing list.
                                </span>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-start gap-1 p-4 hover:bg-destructive/5 hover:border-destructive/30"
                                onClick={() => confirmImport('overwrite')}
                            >
                                <span className="font-bold text-destructive flex items-center gap-1.5">
                                    <Trash2 className="h-4 w-4" /> Overwrite Existing
                                </span>
                                <span className="text-[10px] text-muted-foreground text-left">
                                    Clear everything and show ONLY the imported configuration.
                                </span>
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setIsImportDialogOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </aside >
    );
}
