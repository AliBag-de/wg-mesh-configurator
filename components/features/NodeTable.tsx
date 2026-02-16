"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NodeInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Key, Plus, Trash2, Server, GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { EndpointVersion } from "@/lib/types";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { colorForKey } from "@/lib/color";
import { useState, useMemo } from "react";

interface NodeTableProps {
    nodes: NodeInput[];
    addNode: () => void;
    removeNode: (id: string) => void;
    updateNode: (id: string, patch: Partial<NodeInput>) => void;
    generateNodeKeys: (id: string) => void;
    reorderNodes: (newNodes: NodeInput[]) => void;
    autoGenerateKeys: boolean;
    endpointVersion: EndpointVersion;
    sshHosts?: any[];
}

type SortKey = "name" | "endpoint" | "wgIp" | "sshHost" | "sshUser" | "sshPort" | "listenPort" | "manual";
type SortDir = "asc" | "desc";

export function NodeTable({
    nodes,
    addNode,
    removeNode,
    updateNode,
    generateNodeKeys,
    reorderNodes,
    autoGenerateKeys,
    endpointVersion,
    sshHosts = [],
}: NodeTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("manual");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const sortedNodes = useMemo(() => {
        if (sortKey === "manual") return nodes;

        return [...nodes].sort((a, b) => {
            const valA = a[sortKey as keyof NodeInput] ?? "";
            const valB = b[sortKey as keyof NodeInput] ?? "";

            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [nodes, sortKey, sortDir]);

    const SortIcon = ({ k }: { k: SortKey }) => {
        if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
        return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
    };
    return (
        <div className="rounded-lg border bg-card/50 backdrop-blur-sm overflow-hidden">
            {/* ... Header ... */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold tracking-tight">Nodes</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm">
                        {nodes.length}
                    </Badge>
                </div>
                <Button onClick={addNode} size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                    <Plus className="h-3 w-3" /> Add
                </Button>
            </div>

            <div className="overflow-x-auto">
                {nodes.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No nodes found. Add one to get started.
                    </div>
                ) : (
                    <table className="w-full text-xs text-left">
                        <thead className="bg-muted/10 text-muted-foreground font-medium border-b select-none">
                            <tr>
                                <th
                                    className="px-3 py-2 w-10 text-center cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => setSortKey("manual")}
                                    title="Switch to manual order for drag-and-drop"
                                >
                                    #
                                </th>
                                <th
                                    className="px-3 py-2 w-32 cursor-pointer group"
                                    onClick={() => handleSort("name")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Name <SortIcon k="name" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2 w-48 cursor-pointer group"
                                    onClick={() => handleSort("endpoint")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        WG Endpoint <SortIcon k="endpoint" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2 w-36 cursor-pointer group"
                                    onClick={() => handleSort("sshHost")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        SSH Host <SortIcon k="sshHost" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2 w-28 cursor-pointer group"
                                    onClick={() => handleSort("sshUser")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        User <SortIcon k="sshUser" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2 w-20 cursor-pointer group"
                                    onClick={() => handleSort("sshPort")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Port <SortIcon k="sshPort" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2 w-32 cursor-pointer group"
                                    onClick={() => handleSort("wgIp")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        WG IP <SortIcon k="wgIp" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-2 w-24 cursor-pointer group text-center"
                                    onClick={() => handleSort("listenPort")}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        Port <SortIcon k="listenPort" />
                                    </div>
                                </th>
                                {!autoGenerateKeys && <th className="px-3 py-2">Keys (Private / Public)</th>}
                                <th className="px-3 py-2 w-20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <Reorder.Group
                            as="tbody"
                            axis="y"
                            values={nodes}
                            onReorder={reorderNodes}
                            className="divide-y divide-border/50"
                        >
                            <AnimatePresence mode="popLayout">
                                {sortedNodes.map((node, index) => {
                                    return (
                                        <Reorder.Item
                                            as="tr"
                                            key={node.id}
                                            value={node}
                                            dragListener={sortKey === "manual"}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className={cn(
                                                "group hover:bg-muted/10 transition-colors",
                                                sortKey === "manual" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                                            )}
                                        >
                                            <td className="px-3 py-2 text-center text-muted-foreground font-mono relative">
                                                {sortKey === "manual" && (
                                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                                                    </div>
                                                )}
                                                {index + 1}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const color = colorForKey(`node:${node.id}`);
                                                        return (
                                                            <span
                                                                className="h-2.5 w-2.5 rounded-full border"
                                                                style={{ backgroundColor: color, borderColor: color }}
                                                                title={`Node color: ${color}`}
                                                            />
                                                        );
                                                    })()}
                                                    <Input
                                                        value={node.name}
                                                        onChange={(e) => updateNode(node.id, { name: e.target.value })}
                                                        className="h-7 w-full min-w-[80px] text-xs px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={node.endpoint}
                                                        onChange={(e) => updateNode(node.id, { endpoint: e.target.value })}
                                                        placeholder="IPv6 Endpoint"
                                                        className="h-7 text-xs font-mono px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                    />
                                                    {node.endpoint.includes(":") && !node.endpoint.includes(".") && (
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap" title="Detected as IPv6">
                                                            [IPv6]
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={node.sshHost ?? ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        updateNode(node.id, { sshHost: val });
                                                        // Auto-fill logic
                                                        const match = sshHosts.find(h => h.host === val);
                                                        if (match) {
                                                            const patch: Partial<NodeInput> = {};
                                                            if (match.user) patch.sshUser = match.user;
                                                            if (match.port) patch.sshPort = match.port;
                                                            if (Object.keys(patch).length > 0) updateNode(node.id, patch);
                                                        }
                                                    }}
                                                    placeholder="IPv4 or Alias"
                                                    list={`ssh-hosts-${node.id}`}
                                                    className="h-7 text-xs font-mono px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                />
                                                <datalist id={`ssh-hosts-${node.id}`}>
                                                    {sshHosts.map(h => (
                                                        <option key={h.host} value={h.host} />
                                                    ))}
                                                </datalist>
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={node.sshUser ?? ""}
                                                    onChange={(e) => updateNode(node.id, { sshUser: e.target.value })}
                                                    placeholder="root"
                                                    className="h-7 text-xs font-mono px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    type="number"
                                                    value={node.sshPort ?? 22}
                                                    onChange={(e) => updateNode(node.id, { sshPort: Number(e.target.value) })}
                                                    className="h-7 text-xs font-mono px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={node.wgIp ?? ""}
                                                    onChange={(e) => updateNode(node.id, { wgIp: e.target.value })}
                                                    placeholder={`10.20.0.${index + 1}`}
                                                    className="h-7 text-xs font-mono px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                />
                                            </td>
                                            <td className="px-3 py-2 w-[100px]">
                                                <Input
                                                    type="number"
                                                    value={node.listenPort}
                                                    onChange={(e) => updateNode(node.id, { listenPort: Number(e.target.value) })}
                                                    className="h-7 text-xs font-mono text-center px-1 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                />
                                            </td>
                                            {!autoGenerateKeys && (
                                                <td className="px-3 py-2">
                                                    <div className="grid gap-1">
                                                        <Input
                                                            value={node.privateKey ?? ""}
                                                            onChange={(e) => updateNode(node.id, { privateKey: e.target.value })}
                                                            placeholder="Priv Key"
                                                            className="h-6 w-full font-mono text-[10px] px-2 bg-background/30 border-transparent focus:border-primary/30"
                                                        />
                                                        <Input
                                                            value={node.publicKey}
                                                            onChange={(e) => updateNode(node.id, { publicKey: e.target.value })}
                                                            placeholder="Pub Key"
                                                            className="h-6 w-full font-mono text-[10px] px-2 bg-background/30 border-transparent focus:border-primary/30"
                                                        />
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-3 py-2 w-[100px] text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {node.presharedKey && (
                                                        <div className="relative group mr-2">
                                                            <Key className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                                                            <div className="absolute  right-0 -top-1 hidden group-hover:block bg-popover text-popover-foreground text-[10px] p-2 rounded shadow-lg border z-50 whitespace-normal break-all w-48">
                                                                PSK: {node.presharedKey.substring(0, 8)}...
                                                            </div>
                                                        </div>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            generateNodeKeys(node.id);
                                                        }}
                                                        title="Generate Keys"
                                                    >
                                                        <Key className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeNode(node.id);
                                                        }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </Reorder.Item>
                                    );
                                })}
                            </AnimatePresence>
                        </Reorder.Group>
                    </table>
                )
                }
            </div >
        </div >
    );
}
