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
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, Loader2, XCircle, Terminal, Server, Globe } from "lucide-react";
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
}: BatchDeployModalProps) {
    // Filter nodes that have SSH configured
    const eligibleNodes = nodes.filter(n => n.sshUser && n.sshPort && (n.sshHost || n.endpoint));
    const totalEligible = eligibleNodes.length;

    const successCount = Object.values(nodeStatuses).filter(s => s === "success").length;
    const errorCount = Object.values(nodeStatuses).filter(s => s === "error").length;
    const processedCount = successCount + errorCount;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col bg-amber-50 text-slate-900 border-blue-500/50 shadow-2xl">
                <DialogHeader className="border-b border-blue-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Globe className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight text-blue-900">Batch Remote Deployment</DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">
                                Sequentially deploy configurations to all nodes with SSH credentials.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                    {/* Progress Section */}
                    <div className="space-y-3 bg-white/60 p-4 rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Progress</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {isDeploying ? `Installing on mesh nodes...` : processedCount === totalEligible ? "Deployment Sequence Finished" : "Ready to synchronize"}
                                </p>
                            </div>
                            <p className="text-2xl font-mono font-bold text-blue-600">{Math.round(currentProgress)}%</p>
                        </div>
                        <Progress value={currentProgress} className="h-2.5 bg-blue-100" />
                        <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest">
                            <span className="flex items-center gap-1.5 text-slate-400"><Circle className="h-3 w-3 fill-slate-200" /> Pending: {totalEligible - processedCount - (isDeploying ? 1 : 0)}</span>
                            <span className="flex items-center gap-1.5 text-blue-500"><Loader2 className={cn("h-3 w-3", isDeploying && "animate-spin")} /> Active: {isDeploying ? 1 : 0}</span>
                            <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Success: {successCount}</span>
                            <span className="flex items-center gap-1.5 text-rose-500"><XCircle className="h-3 w-3" /> Error: {errorCount}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-1 min-h-0">
                        {/* Node List Sidebar */}
                        <div className="md:col-span-2 flex flex-col gap-3 min-h-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                                <Server className="h-3 w-3" /> Sequence Status
                            </p>
                            <ScrollArea className="flex-1 border border-blue-100 rounded-xl bg-white/40 p-2 shadow-inner">
                                <div className="space-y-1">
                                    {eligibleNodes.map((node) => {
                                        const status = nodeStatuses[node.id] || "pending";
                                        return (
                                            <div key={node.id} className={cn(
                                                "flex items-center justify-between p-2.5 rounded-lg text-sm transition-all",
                                                status === "deploying" ? "bg-blue-600/10 border border-blue-600/20 shadow-sm" : "hover:bg-blue-50/50"
                                            )}>
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {status === "pending" && <Circle className="h-4 w-4 text-slate-300 shrink-0" />}
                                                    {status === "deploying" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />}
                                                    {status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                                                    {status === "error" && <XCircle className="h-4 w-4 text-rose-500 shrink-0" />}
                                                    <span className={cn(
                                                        "truncate font-medium",
                                                        status === "deploying" ? "text-blue-900" : "text-slate-600"
                                                    )}>{node.name}</span>
                                                </div>
                                                <Badge className={cn(
                                                    "text-[8px] h-3.5 px-1 border-none bg-transparent uppercase tracking-tight font-bold",
                                                    status === "success" && "text-emerald-600",
                                                    status === "error" && "text-rose-500",
                                                    status === "deploying" && "text-blue-600",
                                                    status === "pending" && "text-slate-300"
                                                )}>
                                                    {status}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Logs Area */}
                        <div className="md:col-span-3 flex flex-col gap-3 min-h-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                                <Terminal className="h-3 w-3" /> Live Execution Output
                            </p>
                            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-white/5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                                    <span className="ml-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest">batch_deployer.run</span>
                                </div>
                                <ScrollArea className="flex-1 p-5 font-mono text-[11px] text-emerald-400/90 whitespace-pre-wrap leading-relaxed">
                                    {logs || (isDeploying ? "Bootstrapping sequence..." : "Awaiting user to start deployment cycle...")}
                                    {isDeploying && <span className="inline-block w-1.5 h-3 bg-emerald-500 animate-pulse ml-1 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-blue-100 pt-5 flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isDeploying}
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-6"
                    >
                        {processedCount > 0 ? "Finish" : "Cancel"}
                    </Button>
                    {!isDeploying && processedCount === 0 && (
                        <Button
                            onClick={onStart}
                            disabled={eligibleNodes.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Run Batch Sequence
                        </Button>
                    )}
                    {!isDeploying && processedCount > 0 && processedCount < totalEligible && (
                        <Button
                            onClick={onStart}
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px] active:scale-95 transition-all"
                        >
                            <Loader2 className="mr-2 h-4 w-4" />
                            Resume Sequence
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
