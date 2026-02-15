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
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col bg-slate-950 text-slate-50 border-indigo-500/50 shadow-2xl shadow-indigo-500/10">
                <DialogHeader className="border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Globe className="h-6 w-6 text-indigo-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight">Batch Remote Deployment</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Sequentially deploy configurations to all nodes with SSH credentials.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                    {/* Progress Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Progress</p>
                                <p className="text-sm font-medium">
                                    {isDeploying ? `Deploying to nodes...` : processedCount === totalEligible ? "Deployment Complete" : "Ready to start"}
                                </p>
                            </div>
                            <p className="text-2xl font-mono font-bold text-indigo-400">{Math.round(currentProgress)}%</p>
                        </div>
                        <Progress value={currentProgress} className="h-2 bg-slate-800" />
                        <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                            <span className="flex items-center gap-1.5"><Circle className="h-3 w-3 fill-slate-800" /> Pending: {totalEligible - processedCount - (isDeploying ? 1 : 0)}</span>
                            <span className="flex items-center gap-1.5 text-indigo-400"><Loader2 className={cn("h-3 w-3", isDeploying && "animate-spin")} /> Active: {isDeploying ? 1 : 0}</span>
                            <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Success: {successCount}</span>
                            <span className="flex items-center gap-1.5 text-rose-400"><XCircle className="h-3 w-3" /> Error: {errorCount}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-1 min-h-0">
                        {/* Node List Sidebar */}
                        <div className="md:col-span-2 flex flex-col gap-3 min-h-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <Server className="h-3 w-3" /> Node Status
                            </p>
                            <ScrollArea className="flex-1 border border-white/5 rounded-xl bg-white/5 p-2">
                                <div className="space-y-1">
                                    {eligibleNodes.map((node) => {
                                        const status = nodeStatuses[node.id] || "pending";
                                        return (
                                            <div key={node.id} className={cn(
                                                "flex items-center justify-between p-2 rounded-lg text-sm transition-colors",
                                                status === "deploying" ? "bg-indigo-500/10 border border-indigo-500/20" : "hover:bg-white/5"
                                            )}>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {status === "pending" && <Circle className="h-4 w-4 text-slate-600 shrink-0" />}
                                                    {status === "deploying" && <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />}
                                                    {status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                                                    {status === "error" && <XCircle className="h-4 w-4 text-rose-500 shrink-0" />}
                                                    <span className="truncate font-medium">{node.name}</span>
                                                </div>
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] h-4 px-1 border-none bg-transparent uppercase tracking-tighter opacity-50",
                                                    status === "success" && "text-emerald-400",
                                                    status === "error" && "text-rose-400",
                                                    status === "deploying" && "text-indigo-400"
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
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <Terminal className="h-3 w-3" /> Live Terminal
                            </p>
                            <div className="flex-1 bg-black border border-white/10 rounded-xl overflow-hidden shadow-inner flex flex-col">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5 bg-white/5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="ml-2 text-[9px] font-mono text-slate-500 uppercase tracking-widest">deployer_v2.log</span>
                                </div>
                                <ScrollArea className="flex-1 p-4 font-mono text-xs text-emerald-400/90 whitespace-pre-wrap leading-relaxed">
                                    {logs || (isDeploying ? "Initializing..." : "Waiting for deployment to start...")}
                                    {isDeploying && <span className="inline-block w-1.5 h-3 bg-emerald-500 animate-pulse ml-1" />}
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-white/10 pt-4 flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isDeploying}
                        className="text-slate-400 hover:text-white hover:bg-white/10"
                    >
                        {processedCount > 0 ? "Done" : "Cancel"}
                    </Button>
                    {!isDeploying && processedCount === 0 && (
                        <Button
                            onClick={onStart}
                            disabled={eligibleNodes.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] shadow-lg shadow-indigo-900/40"
                        >
                            Start Batch Deploy
                        </Button>
                    )}
                    {!isDeploying && processedCount > 0 && processedCount < totalEligible && (
                        <Button
                            onClick={onStart}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            Resume Remaining
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
