import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, Loader2, XCircle, Terminal, Server, Globe, Zap, RefreshCw, ShieldAlert, Settings, DownloadCloud } from "lucide-react";
import { NodeInput } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DeployStatus = "pending" | "deploying" | "success" | "error";

interface BatchDeployModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: NodeInput[];
    isDeploying: boolean;
    currentProgress: number; // 0-100
    nodeStatuses: Record<string, DeployStatus>;
    logs: string;
    onStart: () => void;
    deployAction: "deploy_and_execute" | "deploy" | "execute";
    setDeployAction: (val: "deploy_and_execute" | "deploy" | "execute") => void;
}

export function BatchDeployModal({
    isOpen,
    onClose,
    nodes,
    isDeploying,
    currentProgress,
    nodeStatuses,
    logs,
    onStart,
    deployAction,
    setDeployAction,
}: BatchDeployModalProps) {
    // Filter nodes that have SSH configured
    const eligibleNodes = nodes.filter(n => n.sshUser && n.sshPort && (n.sshHost || n.endpoint));
    const totalEligible = eligibleNodes.length;

    const successCount = Object.values(nodeStatuses || {}).filter(s => s === "success").length;
    const errorCount = Object.values(nodeStatuses || {}).filter(s => s === "error").length;
    const processedCount = successCount + errorCount;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col bg-background/95 backdrop-blur-2xl shadow-2xl border-primary/30 transition-all rounded-xl p-0 overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                <DialogHeader className="p-6 pb-2 border-b border-border/50 relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                            <Globe className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight text-white/90">Batch Remote Deployment</DialogTitle>
                            <DialogDescription className="text-muted-foreground/80 mt-1">
                                Sequentially deploy configurations to all nodes with SSH credentials.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 px-6 py-4 custom-scrollbar">
                    {/* Progress Section */}
                    <div className="space-y-4 bg-white/5 backdrop-blur-sm p-5 rounded-xl border border-white/10 shadow-inner">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Mesh Network Status</p>
                                <p className="text-sm font-semibold text-white/80">
                                    {isDeploying ? `Installing on mesh nodes...` : processedCount === totalEligible ? "Deployment Sequence Finished" : "Ready to synchronize sequence"}
                                </p>
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-2xl font-mono font-bold text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{Math.round(currentProgress)}%</p>
                            </div>
                        </div>
                        <Progress value={currentProgress} className="h-2 bg-white/5 overflow-hidden rounded-full">
                            <div className="h-full bg-primary shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-500 rounded-full" style={{ width: `${currentProgress}%` }} />
                        </Progress>
                        <div className="flex flex-wrap gap-4 text-[10px] uppercase font-bold tracking-widest pt-1">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Circle className="h-3 w-3 fill-white/10" /> Pending: {totalEligible - processedCount - (isDeploying ? 1 : 0)}</span>
                            <span className="flex items-center gap-1.5 text-blue-400"><Loader2 className={cn("h-3 w-3", isDeploying && "animate-spin")} /> Active: {isDeploying ? 1 : 0}</span>
                            <span className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="h-3 w-3" /> Success: {successCount}</span>
                            <span className="flex items-center gap-1.5 text-rose-500"><ShieldAlert className="h-3 w-3" /> Error: {errorCount}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-1 min-h-0">
                        {/* Node List Sidebar */}
                        <div className="md:col-span-2 flex flex-col gap-3 min-h-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                                <Server className="h-3.5 w-3.5 text-primary/70" /> Deployment Sequence
                            </p>
                            <ScrollArea className="flex-1 border border-white/10 rounded-xl bg-black/20 p-2 shadow-inner custom-scrollbar">
                                <div className="space-y-1">
                                    {eligibleNodes.map((node) => {
                                        const status = nodeStatuses[node.id] || "pending";
                                        return (
                                            <div key={node.id} className={cn(
                                                "flex items-center justify-between p-2.5 rounded-lg text-sm transition-all border",
                                                status === "deploying"
                                                    ? "bg-primary/10 border-primary/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                                    : "border-transparent hover:bg-white/5"
                                            )}>
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {status === "pending" && <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
                                                    {status === "deploying" && <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />}
                                                    {status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                    {status === "error" && <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                                                    <span className={cn(
                                                        "truncate font-medium",
                                                        status === "deploying" ? "text-primary-foreground" : "text-muted-foreground/90"
                                                    )}>{node.name}</span>
                                                </div>
                                                <Badge className={cn(
                                                    "text-[9px] h-4 px-1.5 border-none uppercase tracking-tighter font-bold",
                                                    status === "success" && "bg-primary/20 text-primary",
                                                    status === "error" && "bg-rose-500/20 text-rose-500",
                                                    status === "deploying" && "bg-blue-500/20 text-blue-400",
                                                    status === "pending" && "bg-white/5 text-muted-foreground/40"
                                                )}>
                                                    {status}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>

                            {/* Deployment Action Selector */}
                            <div className="space-y-3 pt-4 border-t border-border/40 mb-2">
                                <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 ml-1 font-semibold">
                                    <Settings className="h-3 w-3 text-primary/70" /> Deployment Action
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <button
                                        onClick={() => setDeployAction("deploy_and_execute")}
                                        disabled={isDeploying || processedCount > 0}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                                            deployAction === "deploy_and_execute"
                                                ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                                : "bg-black/20 border-border/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5",
                                            (isDeploying || processedCount > 0) && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Zap className="h-4 w-4" />
                                        <span className="text-[10px] font-bold uppercase">Full Setup</span>
                                    </button>
                                    <button
                                        onClick={() => setDeployAction("deploy")}
                                        disabled={isDeploying || processedCount > 0}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                                            deployAction === "deploy"
                                                ? "bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                                : "bg-black/20 border-border/40 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5",
                                            (isDeploying || processedCount > 0) && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <DownloadCloud className="h-4 w-4" />
                                        <span className="text-[10px] font-bold uppercase">Upload Only</span>
                                    </button>
                                    <button
                                        onClick={() => setDeployAction("execute")}
                                        disabled={isDeploying || processedCount > 0}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                                            deployAction === "execute"
                                                ? "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                : "bg-black/20 border-border/40 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/5",
                                            (isDeploying || processedCount > 0) && "opacity-50 cursor-not-allowed"
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
                        </div>

                        {/* Logs Area */}
                        <div className="md:col-span-3 flex flex-col gap-3 min-h-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                                <Terminal className="h-3.5 w-3.5 text-primary/70" /> Execution Log
                            </p>
                            <div className="flex-1 bg-[#050505] border border-white/5 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-white/5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500/60" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                                    <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                                    <span className="ml-3 text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">batch_deploy.run</span>
                                </div>
                                <ScrollArea className="flex-1 p-5 font-mono text-[11px] text-emerald-400/90 whitespace-pre-wrap leading-relaxed custom-scrollbar">
                                    {logs || (isDeploying ? "Bootstrapping remote sequence..." : "Awaiting user to initiate deployment cycle...")}
                                    {isDeploying && <span className="inline-block w-1.5 h-3 bg-emerald-500 animate-pulse ml-1 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-card/40 flex-row justify-end space-x-3 sm:space-x-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isDeploying}
                        className="px-6 border-border/60 hover:bg-secondary transition-colors"
                    >
                        {processedCount > 0 ? "Finish Sequence" : "Cancel"}
                    </Button>
                    {!isDeploying && processedCount === 0 && (
                        <Button
                            onClick={onStart}
                            disabled={eligibleNodes.length === 0}
                            className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] min-w-[180px] h-10 transition-all duration-300 active:scale-95 flex items-center gap-2"
                        >
                            <Zap className="h-4 w-4" />
                            Start Sequence
                        </Button>
                    )}
                    {!isDeploying && processedCount > 0 && processedCount < totalEligible && (
                        <Button
                            onClick={onStart}
                            className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.2)] min-w-[180px] h-10 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Resume Remaining
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
