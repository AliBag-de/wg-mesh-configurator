"use client";

import { useMemo } from "react";
import { NodeInput, ClientInput } from "@/lib/types";
import { colorForKey } from "@/lib/color";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network } from "lucide-react";

interface TopologyViewProps {
    nodes: NodeInput[];
    clients: ClientInput[];
    gatewayNodeNames: string[];
}

export function TopologyView({ nodes, clients, gatewayNodeNames }: TopologyViewProps) {
    const centerX = 400;
    const centerY = 300;
    const nodeRadius = 150;
    const clientRadius = 230;

    const neighborIndices = (index: number, count: number) => {
        if (count <= 1) return [];
        if (count === 2) return [index === 0 ? 1 : 0];
        if (count === 3) return [0, 1, 2].filter((i) => i !== index);
        const offsets = count < 6 ? [1] : [1, 3];
        const neighbors = new Set<number>();
        offsets.forEach((offset) => {
            neighbors.add((index + offset) % count);
            neighbors.add((index - offset + count) % count);
        });
        neighbors.delete(index);
        return Array.from(neighbors);
    };

    const nodePositions = useMemo(() => {
        if (nodes.length === 0) return [];
        return nodes.map((node, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
            return {
                ...node,
                x: centerX + nodeRadius * Math.cos(angle),
                y: centerY + nodeRadius * Math.sin(angle),
                isGateway: gatewayNodeNames.includes(node.name),
                color: colorForKey(`node:${node.id}`)
            };
        });
    }, [nodes, gatewayNodeNames]);

    const nodeLinks = useMemo(() => {
        const links: Array<{ a: number; b: number }> = [];
        const seen = new Set<string>();
        nodes.forEach((_, i) => {
            neighborIndices(i, nodes.length).forEach((j) => {
                const a = Math.min(i, j);
                const b = Math.max(i, j);
                const key = `${a}-${b}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    links.push({ a, b });
                }
            });
        });
        return links;
    }, [nodes]);

    const clientPositions = useMemo(() => {
        if (clients.length === 0) return [];
        return clients.map((client, i) => {
            const angle = (i / clients.length) * 2 * Math.PI - Math.PI / 2;
            return {
                ...client,
                x: centerX + clientRadius * Math.cos(angle),
                y: centerY + clientRadius * Math.sin(angle),
                color: colorForKey(`client:${client.id}`)
            };
        });
    }, [clients]);

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Network Topology (Live)</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative overflow-hidden bg-background/20 min-h-0">
                <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
                    {/* Defs for gradients/markers */}
                    <defs>
                        <linearGradient id="link-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.5" />
                        </linearGradient>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="var(--muted-foreground)" opacity="0.5" />
                        </marker>
                    </defs>

                    {/* Node <-> Node Connections (Ring + i±1, i±3) */}
                    {nodeLinks.map((link, i) => {
                        const a = nodePositions[link.a];
                        const b = nodePositions[link.b];
                        if (!a || !b) return null;
                        const midX = (a.x + b.x) / 2;
                        const midY = (a.y + b.y) / 2;
                        return (
                            <g key={`link-${a.id}-${b.id}`}>
                                <motion.line
                                    x1={a.x}
                                    y1={a.y}
                                    x2={b.x}
                                    y2={b.y}
                                    stroke="#94a3b8"
                                    strokeWidth="1.4"
                                    strokeDasharray="5 4"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 0.45 }}
                                    transition={{ duration: 0.8, delay: i * 0.02 }}
                                >
                                    <title>{`${a.name} ↔ ${b.name}`}</title>
                                </motion.line>
                                <text
                                    x={midX}
                                    y={midY - 6}
                                    textAnchor="middle"
                                    fill="var(--muted-foreground)"
                                    fontSize="9"
                                    className="font-mono"
                                >
                                    mesh link
                                </text>
                            </g>
                        );
                    })}

                    {/* Client Connections (Client -> All Gateways) */}
                    {clientPositions.map((client, i) => {
                        if (gatewayNodeNames.length === 0 || nodePositions.length === 0) return null;
                        return (
                            <g key={client.id}>
                                {gatewayNodeNames.map((gwName) => {
                                    const targetNode = nodePositions.find((n) => n.name === gwName);
                                    if (!targetNode) return null;
                                    const midX = (client.x + targetNode.x) / 2;
                                    const midY = (client.y + targetNode.y) / 2;
                                    return (
                                        <g key={`client-link-${client.id}-${gwName}`}>
                                            <motion.line
                                                x1={client.x}
                                                y1={client.y}
                                                x2={targetNode.x}
                                                y2={targetNode.y}
                                                stroke={client.color}
                                                strokeWidth="1.6"
                                                opacity="0.5"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                                            >
                                                <title>{`${client.name} → ${gwName}`}</title>
                                            </motion.line>
                                            <text
                                                x={midX}
                                                y={midY - 4}
                                                textAnchor="middle"
                                                fill="var(--muted-foreground)"
                                                fontSize="9"
                                                className="font-mono"
                                            >
                                                client link
                                            </text>
                                        </g>
                                    );
                                })}
                                <motion.circle
                                    cx={client.x}
                                    cy={client.y}
                                    r="6"
                                    fill="var(--background)"
                                    stroke={client.color}
                                    strokeWidth="2"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.2 + i * 0.05 }}
                                />
                                <text
                                    x={client.x}
                                    y={client.y + 20}
                                    textAnchor="middle"
                                    fill="var(--muted-foreground)"
                                    fontSize="10"
                                    className="font-mono"
                                >
                                    {client.name}
                                </text>
                            </g>
                        );
                    })}


                    {/* Nodes */}
                    {nodePositions.map((node, i) => (
                        <motion.g
                            key={node.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15, delay: i * 0.1 }}
                        >
                            {/* Pulse effect for Gateways */}
                            {node.isGateway && (
                                <circle cx={node.x} cy={node.y} r="25" fill="var(--primary)" opacity="0.1">
                                    <animate attributeName="r" from="25" to="35" dur="1.5s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" from="0.1" to="0" dur="1.5s" repeatCount="indefinite" />
                                </circle>
                            )}

                            <circle
                                cx={node.x}
                                cy={node.y}
                                r="20"
                                fill="var(--card)"
                                stroke={node.color}
                                strokeWidth={node.isGateway ? 3 : 2}
                            >
                                <title>{`${node.name}\n${node.endpoint || "No IP"}`}</title>
                            </circle>
                            <text
                                x={node.x}
                                y={node.y}
                                dy=".3em"
                                textAnchor="middle"
                                className="text-xs font-bold fill-foreground select-none"
                            >
                                {node.name}
                            </text>
                            <text
                                x={node.x}
                                y={node.y + 35}
                                textAnchor="middle"
                                className="text-[10px] fill-muted-foreground font-mono"
                            >
                                {node.endpoint || "No IP"}
                            </text>
                        </motion.g>
                    ))}
                </svg>

                {/* Legend Overlay */}
                <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur border p-2 rounded-md text-[10px] space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-primary"></div>
                        <span className="text-muted-foreground">Gateway Node</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-border"></div>
                        <span className="text-muted-foreground">Standard Node</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-blue-400"></div>
                        <span className="text-muted-foreground">Client</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
