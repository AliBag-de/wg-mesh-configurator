import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EndpointVersion } from "@/lib/types";
import { Settings2 } from "lucide-react";

interface NetworkSettingsProps {
    networkCidr: string;
    setNetworkCidr: (val: string) => void;
    interfaceName: string;
    setInterfaceName: (val: string) => void;
    endpointVersion: EndpointVersion;
    setEndpointVersion: (val: EndpointVersion) => void;
    persistentKeepalive: number;
    setPersistentKeepalive: (val: number) => void;
    includeIpForwarding: boolean;
    setIncludeIpForwarding: (val: boolean) => void;
    enableBabel: boolean;
    setEnableBabel: (val: boolean) => void;
    autoGenerateKeys: boolean;
    setAutoGenerateKeys: (val: boolean) => void;
}

export function NetworkSettings({
    networkCidr,
    setNetworkCidr,
    interfaceName,
    setInterfaceName,
    endpointVersion,
    setEndpointVersion,
    persistentKeepalive,
    setPersistentKeepalive,
    includeIpForwarding,
    setIncludeIpForwarding,
    enableBabel,
    setEnableBabel,
    autoGenerateKeys,
    setAutoGenerateKeys,
}: NetworkSettingsProps) {
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/10">
                <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Network Configuration</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
                {/* Top Row: Inputs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="cidr" className="text-xs text-muted-foreground">IPv4 CIDR</Label>
                        <Input
                            id="cidr"
                            className="h-8 text-xs font-mono"
                            placeholder="10.20.0.0/24"
                            value={networkCidr}
                            onChange={(e) => setNetworkCidr(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="interface" className="text-xs text-muted-foreground">Interface</Label>
                        <Input
                            id="interface"
                            className="h-8 text-xs font-mono"
                            placeholder="wg0"
                            value={interfaceName}
                            onChange={(e) => setInterfaceName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="version" className="text-xs text-muted-foreground">Endpoint IP</Label>
                        <Select
                            id="version"
                            className="h-8 text-xs"
                            value={endpointVersion}
                            onChange={(e) => setEndpointVersion(e.target.value as EndpointVersion)}
                        >
                            <option value="ipv4">IPv4</option>
                            <option value="ipv6">IPv6</option>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="keepalive" className="text-xs text-muted-foreground">Keepalive (s)</Label>
                        <Input
                            id="keepalive"
                            className="h-8 text-xs font-mono"
                            type="number"
                            min={0}
                            value={persistentKeepalive}
                            onChange={(e) => setPersistentKeepalive(Number(e.target.value))}
                        />
                    </div>
                </div>

                {/* Bottom Row: Toggles */}
                <div className="flex flex-wrap gap-4 pt-1 bg-muted/5 p-2 rounded-md border border-border/30">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="fwd"
                            checked={includeIpForwarding}
                            onChange={(e) => setIncludeIpForwarding(e.target.checked)}
                        />
                        <Label htmlFor="fwd" className="text-xs font-medium cursor-pointer">
                            IP Forwarding
                        </Label>
                    </div>
                    <div className="h-4 w-px bg-border/50 hidden sm:block" />
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="babel"
                            checked={enableBabel}
                            onChange={(e) => setEnableBabel(e.target.checked)}
                        />
                        <Label htmlFor="babel" className="text-xs font-medium cursor-pointer">
                            Babel Config
                        </Label>
                    </div>
                    <div className="h-4 w-px bg-border/50 hidden sm:block" />
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="auto-keys"
                            checked={autoGenerateKeys}
                            onChange={(e) => setAutoGenerateKeys(e.target.checked)}
                        />
                        <Label htmlFor="auto-keys" className="text-xs font-medium cursor-pointer">
                            Auto Key Gen
                        </Label>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
