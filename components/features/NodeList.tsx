"use client";

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NodeInput } from "@/lib/types";
import { Key, Plus, Server, Trash2, Zap, Terminal } from "lucide-react";
import { EndpointVersion } from "@/lib/types";

interface NodeListProps {
    nodes: NodeInput[];
    addNode: () => void;
    removeNode: (id: string) => void;
    updateNode: (id: string, patch: Partial<NodeInput>) => void;
    generateNodeKeys: (id: string) => void;
    autoGenerateKeys: boolean;
    endpointVersion: EndpointVersion;
}

export function NodeList({
    nodes,
    addNode,
    removeNode,
    updateNode,
    generateNodeKeys,
    autoGenerateKeys,
    endpointVersion,
}: NodeListProps) {
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center space-x-2">
                    <Server className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg font-medium">Node Listesi</CardTitle>
                    <Badge variant="secondary" className="rounded-full px-2">
                        {nodes.length}
                    </Badge>
                </div>
                <Button onClick={addNode} size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Node Ekle
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {nodes.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg border-muted-foreground/25">
                        <Server className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                        <h3 className="text-sm font-medium text-muted-foreground">Henüz node eklenmemiş</h3>
                        <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                            Ağa dahil olacak sunucuları ekleyerek başlayın.
                        </p>
                        <Button variant="outline" size="sm" onClick={addNode}>
                            İlk Node'u Ekle
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1">
                        {nodes.map((node, index) => (
                            <Card key={node.id} className="relative group bg-background/50 border-primary/10 hover:border-primary/30 transition-colors">
                                <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <span className="text-muted-foreground text-xs font-mono">#{index + 1}</span>
                                            {node.name}
                                        </CardTitle>
                                    </div>
                                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => generateNodeKeys(node.id)}
                                            title="Key Üret (Tekil)"
                                        >
                                            <Key className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeNode(node.id)}
                                            title="Kaldır"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">İsim</Label>
                                            <Input
                                                value={node.name}
                                                onChange={(e) => updateNode(node.id, { name: e.target.value })}
                                                className="h-8"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Endpoint IP</Label>
                                            <Input
                                                value={node.endpoint}
                                                onChange={(e) => updateNode(node.id, { endpoint: e.target.value })}
                                                placeholder={endpointVersion === "ipv6" ? "2001:db8::1" : "203.0.113.10"}
                                                className="h-8 font-mono text-xs"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Listen Port</Label>
                                            <Input
                                                type="number"
                                                value={node.listenPort}
                                                onChange={(e) => updateNode(node.id, { listenPort: Number(e.target.value) })}
                                                className="h-8 font-mono text-xs"
                                            />
                                        </div>

                                        )}

                                        <div className="space-y-2 sm:col-span-2 pt-2">
                                            <div className="flex items-center gap-2 text-xs font-medium text-primary">
                                                <Terminal className="h-3 w-3" />
                                                SSH Dağıtım Ayarları
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground">SSH Kullanıcı</Label>
                                                    <Input
                                                        value={node.sshUser || ""}
                                                        onChange={(e) => updateNode(node.id, { sshUser: e.target.value })}
                                                        placeholder="root"
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground">SSH Port</Label>
                                                    <Input
                                                        type="number"
                                                        value={node.sshPort || 22}
                                                        onChange={(e) => updateNode(node.id, { sshPort: Number(e.target.value) })}
                                                        className="h-8 font-mono text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
