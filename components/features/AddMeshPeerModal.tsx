"use client";

import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Server, User, Plus, CheckCircle2, Globe } from "lucide-react";
import { NodeInput, ClientInput } from "@/lib/types";
import { Peer } from "@/lib/provisioning/contracts";
import { cn } from "@/lib/utils";

interface AddMeshPeerModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: NodeInput[];
    clients: ClientInput[];
    existingPeers: Peer[];
    onImport: (peers: Partial<Peer>[]) => void;
}

export function AddMeshPeerModal({
    isOpen,
    onClose,
    nodes,
    clients,
    existingPeers,
    onImport,
}: AddMeshPeerModalProps) {
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const existingPublicKeys = useMemo(
        () => new Set(existingPeers.map((p) => p.publicKey)),
        [existingPeers]
    );

    const availableEntities = useMemo(() => {
        const list: Array<{ id: string; name: string; type: "Node" | "Client"; publicKey: string; endpoint?: string; wgIp?: string }> = [];

        nodes.forEach(n => {
            if (!existingPublicKeys.has(n.publicKey)) {
                list.push({ id: n.id, name: n.name, type: "Node", publicKey: n.publicKey, endpoint: n.endpoint, wgIp: n.wgIp });
            }
        });

        clients.forEach(c => {
            if (!existingPublicKeys.has(c.publicKey)) {
                list.push({ id: c.id, name: c.name, type: "Client", publicKey: c.publicKey, wgIp: c.wgIp });
            }
        });

        if (!search) return list;
        const lowSearch = search.toLowerCase();
        return list.filter(e =>
            e.name.toLowerCase().includes(lowSearch) ||
            e.publicKey.toLowerCase().includes(lowSearch) ||
            e.wgIp?.toLowerCase().includes(lowSearch)
        );
    }, [nodes, clients, existingPublicKeys, search]);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleImport = () => {
        const toImport: Partial<Peer>[] = [];
        availableEntities.forEach(e => {
            if (selectedIds.has(e.id)) {
                toImport.push({
                    peerId: crypto.randomUUID(),
                    name: e.name,
                    publicKey: e.publicKey,
                    allowedIps: e.wgIp ? [`${e.wgIp}/32`] : [],
                    endpoint: e.endpoint || undefined,
                    isActive: true
                });
            }
        });
        onImport(toImport);
        onClose();
        setSelectedIds(new Set());
    };

    return (
        <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col bg-background/95 backdrop-blur-2xl shadow-2xl border-primary/30 rounded-xl overflow-hidden p-0">
                <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-primary/50 to-transparent pointer-events-none"></div>

                <div className="p-6 pb-2">
                    <DialogHeader className="border-b border-border/50 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Plus className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <DialogTitle className="text-xl font-bold tracking-tight">Import from Mesh Design</DialogTitle>
                        </div>
                        <DialogDescription className="text-muted-foreground/80">
                            Select nodes or clients from your network design to add as peers to this interface.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 py-2 pb-0">
                    <div className="relative group mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search by name, key or IP..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 bg-black/20 border-border/40 focus:border-primary/50 focus:bg-background/80 transition-all font-medium text-xs"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar min-h-[300px]">
                    {availableEntities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground opacity-60">
                            < Globe className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm italic">No additional entities found in your mesh design.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-4">
                            {availableEntities.map((entity) => {
                                const selected = selectedIds.has(entity.id);
                                return (
                                    <div
                                        key={entity.id}
                                        onClick={() => toggleSelect(entity.id)}
                                        className={cn(
                                            "group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                            selected
                                                ? "bg-primary/15 border-primary shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                                : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center transition-all",
                                            selected
                                                ? "bg-primary/20 border-primary/40 text-primary"
                                                : "bg-black/40 border-white/10 text-muted-foreground group-hover:text-primary/70"
                                        )}>
                                            {entity.type === "Node" ? <Server className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm truncate">{entity.name}</span>
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] h-4 uppercase tracking-tighter px-1",
                                                    entity.type === "Node" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                )}>
                                                    {entity.type}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[150px]">{entity.publicKey}</span>
                                                {entity.wgIp && (
                                                    <span className="text-[10px] font-mono text-primary/70 font-semibold">{entity.wgIp}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className={cn(
                                            "h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                                            selected ? "bg-primary border-primary text-primary-foreground" : "border-white/20 text-transparent"
                                        )}>
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-card/40 flex-row justify-end space-x-3 sm:space-x-4">
                    <Button variant="outline" onClick={onClose} className="px-6 border-border/60 hover:bg-secondary transition-colors h-9 text-xs">
                        Cancel
                    </Button>
                    <Button
                        disabled={selectedIds.size === 0}
                        onClick={handleImport}
                        className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] min-w-[120px] h-9 text-xs transition-all duration-300"
                    >
                        Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
