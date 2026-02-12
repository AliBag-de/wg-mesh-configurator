"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NodeInput } from "@/lib/types";
import { Key, Plus, Trash2, Server } from "lucide-react";
import { EndpointVersion } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { colorForKey } from "@/lib/color";

interface NodeTableProps {
    nodes: NodeInput[];
    addNode: () => void;
    removeNode: (id: string) => void;
    updateNode: (id: string, patch: Partial<NodeInput>) => void;
    generateNodeKeys: (id: string) => void;
    autoGenerateKeys: boolean;
    endpointVersion: EndpointVersion;
}

export function NodeTable({
    nodes,
    addNode,
    removeNode,
    updateNode,
    generateNodeKeys,
    autoGenerateKeys,
    endpointVersion,
}: NodeTableProps) {
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
                        <thead className="bg-muted/10 text-muted-foreground font-medium border-b">
                            <tr>
                                <th className="px-3 py-2 w-10 text-center">#</th>
                                <th className="px-3 py-2 w-32">Name</th>
                                <th className="px-3 py-2 w-48">Endpoint</th>
                                <th className="px-3 py-2 w-24">Port</th>
                                {!autoGenerateKeys && <th className="px-3 py-2">Keys (Private / Public)</th>}
                                <th className="px-3 py-2 w-20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            <AnimatePresence mode="popLayout">
                                {nodes.map((node, index) => {
                                    return (
                                        <motion.tr
                                            key={node.id}
                                            layout
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="group hover:bg-muted/10 transition-colors"
                                        >
                                            <td className="px-3 py-2 text-center text-muted-foreground font-mono">
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
                                                        className="h-7 text-xs font-mono px-2 bg-background/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                                                    />
                                                    {node.endpoint.includes(":") && !node.endpoint.includes(".") && (
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap" title="Detected as IPv6">
                                                            [IPv6]
                                                        </span>
                                                    )}
                                                </div>
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
                                                        onClick={() => generateNodeKeys(node.id)}
                                                        title="Generate Keys"
                                                    >
                                                        <Key className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeNode(node.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                )
                }
            </div >
        </div >
    );
}
