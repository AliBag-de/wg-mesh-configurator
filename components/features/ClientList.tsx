"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientInput } from "@/lib/types";
import { Key, Plus, Trash2, Users } from "lucide-react";

interface ClientListProps {
    clients: ClientInput[];
    addClient: () => void;
    removeClient: (id: string) => void;
    updateClient: (id: string, patch: Partial<ClientInput>) => void;
    generateClientKeys: (id: string) => void;
    autoGenerateKeys: boolean;
}

export function ClientList({
    clients,
    addClient,
    removeClient,
    updateClient,
    generateClientKeys,
    autoGenerateKeys,
}: ClientListProps) {
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm mt-6">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    <CardTitle className="text-lg font-medium">Client Listesi</CardTitle>
                    <Badge variant="secondary" className="rounded-full px-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                        {clients.length}
                    </Badge>
                </div>
                <Button onClick={addClient} size="sm" variant="outline" className="gap-1 border-blue-500/20 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300">
                    <Plus className="h-4 w-4" /> Client Ekle
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {clients.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed rounded-lg border-muted-foreground/25">
                        <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                        <h3 className="text-sm font-medium text-muted-foreground">Henüz client eklenmemiş</h3>
                        <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                            Gateway üzerinden internete çıkacak cihazları ekleyin.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1">
                        {clients.map((client, index) => (
                            <Card key={client.id} className="relative group bg-background/50 border-blue-500/10 hover:border-blue-500/30 transition-colors">
                                <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <span className="text-muted-foreground text-xs font-mono">C-{index + 1}</span>
                                            {client.name}
                                        </CardTitle>
                                    </div>
                                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-blue-400"
                                            onClick={() => generateClientKeys(client.id)}
                                            title="Key Üret"
                                        >
                                            <Key className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeClient(client.id)}
                                            title="Kaldır"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5 sm:col-span-2">
                                            <Label className="text-xs text-muted-foreground">İsim</Label>
                                            <Input
                                                value={client.name}
                                                onChange={(e) => updateClient(client.id, { name: e.target.value })}
                                                className="h-8"
                                            />
                                        </div>

                                        {!autoGenerateKeys && (
                                            <>
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <Label className="text-xs text-muted-foreground">Private Key</Label>
                                                    <Input
                                                        value={client.privateKey ?? ""}
                                                        onChange={(e) => updateClient(client.id, { privateKey: e.target.value })}
                                                        placeholder="Base64 Private Key..."
                                                        className="h-8 font-mono text-xs bg-muted/30"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <Label className="text-xs text-muted-foreground">Public Key</Label>
                                                    <Input
                                                        value={client.publicKey}
                                                        onChange={(e) => updateClient(client.id, { publicKey: e.target.value })}
                                                        placeholder="Base64 Public Key..."
                                                        className="h-8 font-mono text-xs bg-muted/30"
                                                    />
                                                </div>
                                            </>
                                        )}
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
