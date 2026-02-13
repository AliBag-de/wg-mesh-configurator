"use client";

import { cn } from "@/lib/utils";
import { parseWgConfig, convertConfigToMesh } from "@/lib/import";
import { useRef } from "react";
import { useMeshStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, LayoutDashboard, RefreshCw, Zap, Server, Network, Shield, Upload } from "lucide-react";
import { EndpointVersion } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
    nodesCount: number;
    clientsCount: number;
    gatewayCount: number;
    endpointVersion: EndpointVersion;
    networkCidr: string;
    persistentKeepalive: number;
    autoGenerateKeys: boolean;
    includeIpForwarding: boolean;
    enableBabel: boolean;
    gatewayNodeNames: string[];
    busy: boolean;
    fillGeneratedKeys: () => void;
    handleSubmit: () => void;
    handleDeploy?: () => void;
    handleRemoteDeploy?: () => void;
    resetForm: () => void;
    className?: string;
}

export function Sidebar({
    nodesCount,
    clientsCount,
    gatewayCount,
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
    handleDeploy,
    handleRemoteDeploy,
    resetForm,
    className,
}: SidebarProps) {
    const { nodes, clients, setNodes, setClients } = useMeshStore();
    const pathname = usePathname();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const config = parseWgConfig(text);
            const { nodes: newNodes, clients: newClients } = convertConfigToMesh(config, nodes, clients);

            if (newNodes.length > 0 || newClients.length > 0) {
                if (confirm(`Found ${newNodes.length} new nodes and ${newClients.length} new clients. Import them?`)) {
                    setNodes((prev) => [...prev, ...newNodes]);
                    setClients((prev) => [...prev, ...newClients]);
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

    return (
        <aside className={cn("flex flex-col h-screen border-r bg-card/50 backdrop-blur-xl", className)}>
            {/* Logo / Header */}
            <div className="p-6 border-b border-border/50">
                <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                        <Network className="h-5 w-5" />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight">Mesh Config</h1>
                </div>
                <p className="text-xs text-muted-foreground ml-10">WireGuard Topology Gen</p>
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
            <div className="p-4 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/30 border border-secondary/50">
                    <div className="text-xs text-muted-foreground mb-1">Nodes</div>
                    <div className="text-2xl font-bold font-mono">{nodesCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-secondary/50">
                    <div className="text-xs text-muted-foreground mb-1">Clients</div>
                    <div className="text-2xl font-bold font-mono text-blue-400">{clientsCount}</div>
                </div>
            </div>

            {/* Configuration Summary List */}
            <div className="px-4 py-2 space-y-1 flex-1 overflow-y-auto">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Global Settings
                </div>

                <div className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4" /> Endpoint
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">{endpointVersion.toUpperCase()}</Badge>
                </div>

                <div className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="text-sm text-muted-foreground">CIDR</span>
                    <span className="text-xs font-mono text-foreground">{networkCidr}</span>
                </div>

                <div className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="text-sm text-muted-foreground">Keepalive</span>
                    <span className="text-xs font-mono text-foreground">{persistentKeepalive}s</span>
                </div>

                <div className="mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Features
                </div>

                <div className="px-2 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Auto Key Gen</span>
                        <div className={`h-2 w-2 rounded-full ${autoGenerateKeys ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-muted"}`} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">IP Forwarding</span>
                        <div className={`h-2 w-2 rounded-full ${includeIpForwarding ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-muted"}`} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Babel Routing</span>
                        <div className={`h-2 w-2 rounded-full ${enableBabel ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-muted"}`} />
                    </div>
                </div>

                <div className="mt-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Gateways ({gatewayCount})
                </div>
                <div className="px-2 flex flex-wrap gap-1.5">
                    {gatewayNodeNames.length > 0 ? (
                        gatewayNodeNames.map(gw => (
                            <Badge key={`sb-gw-${gw}`} variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                {gw}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-xs text-muted-foreground italic">None selected</span>
                    )}
                </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t border-border/50 bg-background/50 space-y-2">
                <Button
                    className="w-full font-semibold shadow-lg shadow-primary/20"
                    size="sm"
                    onClick={fillGeneratedKeys}
                    disabled={busy}
                >
                    <Zap className="mr-2 h-4 w-4" />
                    {busy ? "Processing..." : "Generate Keys"}
                </Button>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".conf,.txt"
                    onChange={handleFileImport}
                />

                <Button
                    variant="outline"
                    className="w-full"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Import Config
                </Button>

                <Button
                    variant="secondary"
                    className="w-full"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={busy}
                >
                    <Download className="mr-2 h-4 w-4" />
                    {busy ? "Downloading..." : "Download (.zip)"}
                </Button>

                {handleRemoteDeploy && (
                    <Button
                        variant="default"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                        size="sm"
                        onClick={handleRemoteDeploy}
                        disabled={busy}
                    >
                        <Server className="mr-2 h-4 w-4" />
                        {busy ? "Deploying..." : "Deploy to Remote"}
                    </Button>
                )}
                {handleDeploy && (
                    <Button
                        variant="default"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                        size="sm"
                        onClick={handleDeploy}
                        disabled={busy}
                    >
                        <Zap className="mr-2 h-4 w-4" />
                        {busy ? "Deploying..." : "Activate on Host"}
                    </Button>
                )}
                <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-destructive text-xs h-8"
                    onClick={resetForm}
                    disabled={busy}
                >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Reset
                </Button>

                <div className="pt-2 text-center text-[10px] text-muted-foreground/80 border-t border-border/30">
                    Developed with AI by Ali Bagdatli
                </div>
            </div>
        </aside>
    );
}
