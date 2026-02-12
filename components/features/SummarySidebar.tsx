import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Files, RefreshCw, Trash2, Zap } from "lucide-react";
import { EndpointVersion } from "@/lib/types";

interface SummarySidebarProps {
    nodesCount: number;
    clientsCount: number;
    gatewayCount: number;
    endpointVersion: EndpointVersion;
    networkCidr: string;
    persistentKeepalive: number;
    autoGenerateKeys: boolean;
    includeIpForwarding: boolean;
    enableBabel: boolean;
    gatewayNodeNames: string[];
    busy: boolean;
    fillGeneratedKeys: () => void;
    handleSubmit: () => void;
    resetForm: () => void;
}

export function SummarySidebar({
    nodesCount,
    clientsCount,
    gatewayCount,
    endpointVersion,
    networkCidr,
    persistentKeepalive,
    autoGenerateKeys,
    includeIpForwarding,
    enableBabel,
    gatewayNodeNames,
    busy,
    fillGeneratedKeys,
    handleSubmit,
    resetForm,
}: SummarySidebarProps) {
    return (
        <aside className="space-y-6 sticky top-6">
            {/* Quick Status Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Hızlı Durum
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5">Anlık</Badge>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-2xl font-bold">{nodesCount}</div>
                            <div className="text-xs text-muted-foreground">Node</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{clientsCount}</div>
                            <div className="text-xs text-muted-foreground">Client</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Gateway</span>
                            <span className="font-medium">{gatewayCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Endpoint</span>
                            <span className="font-medium">{endpointVersion.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">CIDR</span>
                            <span className="font-medium font-mono text-xs">{networkCidr}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Configuration Summary */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Konfig Özeti
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Auto Key Gen</span>
                        <Badge variant={autoGenerateKeys ? "default" : "outline"} className="text-[10px]">
                            {autoGenerateKeys ? "AÇIK" : "KAPALI"}
                        </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">IP Fwd</span>
                        <Badge variant={includeIpForwarding ? "default" : "outline"} className="text-[10px]">
                            {includeIpForwarding ? "AÇIK" : "KAPALI"}
                        </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Babel</span>
                        <Badge variant={enableBabel ? "default" : "outline"} className="text-[10px]">
                            {enableBabel ? "AÇIK" : "KAPALI"}
                        </Badge>
                    </div>

                    <div className="pt-2">
                        <div className="text-xs text-muted-foreground mb-2">Gateways</div>
                        <div className="flex flex-wrap gap-1.5">
                            {gatewayNodeNames.length > 0 ? (
                                gatewayNodeNames.map(gw => (
                                    <Badge key={`s-gw-${gw}`} variant="secondary" className="text-[10px]">
                                        {gw}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground italic">Seçim yok</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-md shadow-2xl border-primary/20">
                <CardContent className="p-4 space-y-3">
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={fillGeneratedKeys}
                        disabled={busy}
                    >
                        <Zap className="mr-2 h-4 w-4" />
                        {busy ? "İşleniyor..." : "Tümüne Key Üret"}
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full border-primary/20 hover:bg-primary/5"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={busy}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        {busy ? "İndiriliyor..." : "Konfigleri İndir"}
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full text-muted-foreground hover:text-destructive"
                        size="sm"
                        onClick={resetForm}
                        disabled={busy}
                    >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Formu Sıfırla
                    </Button>
                </CardContent>
            </Card>
        </aside>
    );
}
