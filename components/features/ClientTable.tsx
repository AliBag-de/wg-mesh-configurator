"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClientInput } from "@/lib/types";
import { Key, Plus, Trash2, Users, GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { colorForKey } from "@/lib/color";
import { QRCodeDialog } from "./QRCodeDialog";
import { useState, useMemo } from "react";
import { useMeshStore } from "@/lib/store";
import { generateClientConfig } from "@/lib/qr-config";
import { QrCode as QrIcon } from "lucide-react";
import { calculateClientIp } from "@/lib/ip-utils";
import { deriveDeterministicPsk } from "@/lib/psk";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClientTableProps {
    clients: ClientInput[];
    addClient: () => void;
    removeClient: (id: string) => void;
    updateClient: (id: string, patch: Partial<ClientInput>) => void;
    generateClientKeys: (id: string) => void;
    reorderClients: (newClients: ClientInput[]) => void;
    autoGenerateKeys: boolean;
}

type SortKey = "name" | "wgIp" | "manual";
type SortDir = "asc" | "desc";

export function ClientTable({
    clients,
    addClient,
    removeClient,
    updateClient,
    generateClientKeys,
    reorderClients,
    autoGenerateKeys,
}: ClientTableProps) {
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

    const sortedClients = useMemo(() => {
        if (sortKey === "manual") return clients;

        return [...clients].sort((a, b) => {
            const valA = a[sortKey as keyof ClientInput] ?? "";
            const valB = b[sortKey as keyof ClientInput] ?? "";

            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [clients, sortKey, sortDir]);

    const SortIcon = ({ k }: { k: SortKey }) => {
        if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
        return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowDown className="h-3 w-3 text-blue-400" />;
    };
    const [qrClient, setQrClient] = useState<{ name: string; config: string } | null>(null);
    const { nodes, networkCidr, endpointVersion, persistentKeepalive, gatewayNodeNames, mtu } = useMeshStore();

    const handleShowQR = (client: ClientInput) => {
        try {
            const gatewayNodes = nodes.filter(n => gatewayNodeNames.includes(n.name));
            if (gatewayNodes.length === 0) {
                toast.error("You must select at least one gateway for QR.");
                return;
            }

            if (!client.privateKey) {
                toast.error("Client private key is required to generate QR.");
                return;
            }

            const clientIndex = clients.findIndex((c) => c.id === client.id);
            if (clientIndex === -1) {
                toast.error("Client not found.");
                return;
            }

            const pskMap: Record<string, string> = {};
            gatewayNodes.forEach(gw => {
                pskMap[gw.name] = deriveDeterministicPsk(client.name, gw.name);
            });

            const config = generateClientConfig(
                client,
                calculateClientIp(networkCidr, clientIndex),
                gatewayNodes,
                networkCidr,
                endpointVersion,
                persistentKeepalive,
                mtu,
                pskMap
            );

            setQrClient({ name: client.name, config });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to generate QR configuration.");
        }
    };

    return (
        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden mt-6 relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between p-4 border-b border-border/40 bg-secondary/30 relative z-10">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                        <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold tracking-wide">Network Clients</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm bg-blue-500/10 text-blue-400 border-transparent">
                        {clients.length}
                    </Badge>
                </div>
                <Button onClick={addClient} size="sm" variant="outline" className="h-8 text-xs gap-1.5 bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)] transition-all">
                    <Plus className="h-3.5 w-3.5" /> Add Client
                </Button>
            </div>

            <div className="overflow-x-auto relative z-10">
                {clients.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground/70 text-sm italic bg-black/10 border-t border-dashed border-border/40">
                        No clients configured. Add a client device (laptop, phone, etc) to access the network.
                    </div>
                ) : (
                    <table className="w-full text-xs text-left">
                        <thead className="bg-black/20 text-muted-foreground font-medium border-b border-border/40 select-none">
                            <tr>
                                <th
                                    className="px-3 py-2 w-16 text-center cursor-pointer hover:text-blue-400 transition-colors"
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
                                    className="px-3 py-2 w-32 cursor-pointer group"
                                    onClick={() => handleSort("wgIp")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        WG IP <SortIcon k="wgIp" />
                                    </div>
                                </th>
                                {!autoGenerateKeys && <th className="px-3 py-2">Keys (Private / Public)</th>}
                                <th className="px-3 py-2 w-[100px] text-right">Actions</th>
                            </tr>
                        </thead>
                        <Reorder.Group
                            as="tbody"
                            axis="y"
                            values={clients}
                            onReorder={reorderClients}
                            className="divide-y divide-border/50"
                        >
                            <AnimatePresence mode="popLayout">
                                {sortedClients.map((client, index) => {
                                    return (
                                        <Reorder.Item
                                            as="tr"
                                            key={client.id}
                                            value={client}
                                            dragListener={sortKey === "manual"}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className={cn(
                                                "group hover:bg-white/5 transition-colors",
                                                sortKey === "manual" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                                            )}
                                        >
                                            <td className="px-3 py-2 text-center text-muted-foreground font-mono relative">
                                                {sortKey === "manual" && (
                                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                                                    </div>
                                                )}
                                                C-{index + 1}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const color = colorForKey(`client:${client.id}`);
                                                        return (
                                                            <span
                                                                className="h-2.5 w-2.5 rounded-full border"
                                                                style={{ backgroundColor: color, borderColor: color }}
                                                                title={`Client color: ${color}`}
                                                            />
                                                        );
                                                    })()}
                                                    <Input
                                                        value={client.name}
                                                        onChange={(e) => updateClient(client.id, { name: e.target.value })}
                                                        className="h-8 w-full min-w-[120px] text-xs px-2.5 bg-black/20 border-border/40 focus:border-blue-500/50 focus:bg-background/80 transition-all font-medium"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={client.wgIp ?? ""}
                                                    onChange={(e) => updateClient(client.id, { wgIp: e.target.value })}
                                                    placeholder={`10.20.0.${index + 101}`}
                                                    className="h-8 text-xs font-mono px-2.5 bg-black/20 border-border/40 focus:border-blue-500/50 focus:bg-background/80 transition-all"
                                                />
                                            </td>
                                            {!autoGenerateKeys && (
                                                <td className="px-3 py-2">
                                                    <div className="grid gap-1.5 opacity-60 hover:opacity-100 transition-opacity focus-within:opacity-100">
                                                        <Input
                                                            value={client.privateKey ?? ""}
                                                            onChange={(e) => updateClient(client.id, { privateKey: e.target.value })}
                                                            placeholder="Priv Key"
                                                            className="h-7 w-full font-mono text-[10px] px-2 bg-black/40 border-border/20 focus:border-blue-500/40 focus:bg-black/80"
                                                        />
                                                        <Input
                                                            value={client.publicKey}
                                                            onChange={(e) => updateClient(client.id, { publicKey: e.target.value })}
                                                            placeholder="Pub Key"
                                                            className="h-7 w-full font-mono text-[10px] px-2 bg-black/40 border-border/20 focus:border-blue-500/40 focus:bg-black/80"
                                                        />
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-3 py-2 w-[100px] text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShowQR(client);
                                                        }}
                                                        title="Show QR Code"
                                                    >
                                                        <QrIcon className="h-4 w-4" />
                                                    </Button>
                                                    {client.presharedKey && (
                                                        <div className="relative group/tooltip mr-2">
                                                            <Key className="h-4 w-4 text-emerald-500 cursor-help" />
                                                            <div className="absolute right-0 -top-8 hidden group-hover/tooltip:block bg-black/90 backdrop-blur-md text-emerald-400 text-xs font-mono p-2 rounded shadow-lg border border-emerald-500/30 z-50 whitespace-nowrap">
                                                                PSK: {client.presharedKey.substring(0, 8)}...
                                                            </div>
                                                        </div>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            generateClientKeys(client.id);
                                                        }}
                                                        title="Regenerate Keys"
                                                    >
                                                        <Key className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeClient(client.id);
                                                        }}
                                                        title="Delete Client"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </Reorder.Item>
                                    );
                                })}
                            </AnimatePresence>
                        </Reorder.Group>
                    </table>
                )}
            </div>

            {qrClient && (
                <QRCodeDialog
                    isOpen={!!qrClient}
                    onClose={() => setQrClient(null)}
                    clientName={qrClient.name}
                    config={qrClient.config}
                />
            )}
        </div>
    );
}
