"use client";

import { useMemo, useState } from "react";
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
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    const centerX = 400;
    const centerY = 350;
    const nodeRadius = 220;
    const clientRadius = 320;

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
        <Card className="border-border/50 bg-card/40 backdrop-blur-md h-full flex flex-col shadow-sm">
            <CardHeader className="py-4 px-6 shrink-0 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <Network className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold tracking-tight text-foreground">Network Topology Preview</CardTitle>
                        <p className="text-xs text-muted-foreground/80 font-medium">Visualizing Mesh & Client Connections</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative overflow-hidden bg-background/20 min-h-0">
                <svg width="100%" height="100%" viewBox="0 0 800 700" preserveAspectRatio="xMidYMid meet">
                    {/* Defs for gradients/markers */}
                    <defs>
                        <linearGradient id="link-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.5" />
                        </linearGradient>
                    </defs>

                    {/* Node <-> Node Connections (Ring + i±1, i±3) */}
                    {nodeLinks.map((link, i) => {
                        const a = nodePositions[link.a];
                        const b = nodePositions[link.b];
                        if (!a || !b) return null;
                        return (
                            <motion.line
                                key={`link-${a.id}-${b.id}`}
                                x1={a.x}
                                y1={a.y}
                                x2={b.x}
                                y2={b.y}
                                stroke="currentColor"
                                className="text-border"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                                opacity="0.4"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 0.4 }}
                                transition={{ duration: 0.8, delay: i * 0.02 }}
                            >
                                <title>{`${a.name} ↔ ${b.name}`}</title>
                            </motion.line>
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
                                    return (
                                        <motion.line
                                            key={`client-link-${client.id}-${gwName}`}
                                            x1={client.x}
                                            y1={client.y}
                                            x2={targetNode.x}
                                            y2={targetNode.y}
                                            stroke={client.color}
                                            strokeWidth="1.5"
                                            opacity="0.4"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                                        >
                                            <title>{`${client.name} → ${gwName}`}</title>
                                        </motion.line>
                                    );
                                })}
                                <motion.circle
                                    cx={client.x}
                                    cy={client.y}
                                    r="10"
                                    fill="var(--background)"
                                    stroke={client.color}
                                    strokeWidth="3"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.2 + i * 0.05 }}
                                    whileHover={{ scale: 1.2 }}
                                    onMouseEnter={() => setHoveredNode(client.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                />
                                {/* Client Number inside circle */}
                                <text
                                    x={client.x}
                                    y={client.y}
                                    dy=".3em"
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="10"
                                    fontWeight="900"
                                    className="select-none pointer-events-none"
                                >
                                    {i + 1}
                                </text>
                                {/* Client Name below circle */}
                                <text
                                    x={client.x}
                                    y={client.y + 25}
                                    textAnchor="middle"
                                    fill="var(--foreground)"
                                    fontSize="11"
                                    fontWeight="600"
                                    className="font-mono select-none pointer-events-none opacity-80"
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
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            className="cursor-pointer"
                        >
                            {/* Pulse effect for Gateways */}
                            {node.isGateway && (
                                <circle cx={node.x} cy={node.y} r="28" fill="var(--primary)" opacity="0.1">
                                    <animate attributeName="r" from="28" to="38" dur="2s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" from="0.15" to="0" dur="2s" repeatCount="indefinite" />
                                </circle>
                            )}

                            <motion.circle
                                cx={node.x}
                                cy={node.y}
                                r="22"
                                fill="var(--card)"
                                stroke={node.color}
                                strokeWidth={node.isGateway ? 4 : 2.5}
                                whileHover={{ scale: 1.1 }}
                            >
                                <title>{`${node.name}`}</title>
                            </motion.circle>

                            {/* Node Index (Inside Circle) */}
                            <text
                                x={node.x}
                                y={node.y}
                                dy=".35em"
                                textAnchor="middle"
                                className="text-[14px] font-black"
                                fill="white"
                                style={{ pointerEvents: "none", userSelect: "none" }}
                            >
                                {i + 1}
                            </text>

                            {/* Node Name (Below Circle) */}
                            <text
                                x={node.x}
                                y={node.y + 35}
                                textAnchor="middle"
                                className="text-[10px] font-bold fill-foreground select-none pointer-events-none opacity-80 uppercase tracking-tight"
                                style={{ textShadow: "0 0 4px var(--background)" }}
                            >
                                {node.name.length > 10 ? node.name.slice(0, 8) + ".." : node.name}
                            </text>

                            {/* Details (Visible on Hover) */}
                            {hoveredNode === node.id && (
                                <motion.g
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <rect
                                        x={node.x - 70}
                                        y={node.y + 32}
                                        width="140"
                                        height="28"
                                        rx="6"
                                        fill="#1e293b"
                                        className="shadow-2xl"
                                    />
                                    <path d={`M ${node.x} ${node.y + 32} l -6 0 l 6 -6 l 6 6 z`} fill="#1e293b" />

                                    <text
                                        x={node.x}
                                        y={node.y + 51}
                                        textAnchor="middle"
                                        fill="#f8fafc"
                                        className="text-[11px] font-mono font-bold select-none pointer-events-none"
                                    >
                                        {node.endpoint || `10.20.0.${100 + i}`}
                                    </text>
                                </motion.g>
                            )}
                        </motion.g>
                    ))}
                </svg>

                {/* Legend Overlay */}
                <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur border p-2 rounded-md text-[10px] space-y-1 shadow-sm">
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
