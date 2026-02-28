import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";

interface GatewaySelectionProps {
    nodeNames: string[];
    gatewayNodeNames: string[];
    toggleGateway: (name: string) => void;
}

export function GatewaySelection({
    nodeNames = [],
    gatewayNodeNames = [],
    toggleGateway,
}: GatewaySelectionProps) {
    return (
        <Card className="border-border/40 bg-card/40 backdrop-blur-md shadow-lg h-full overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />
            <CardHeader className="py-3 px-5 border-b border-border/40 bg-secondary/30">
                <div className="flex items-center gap-2.5 relative z-10">
                    <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <Globe className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold tracking-wide">Network Gateways</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-5 flex flex-col justify-center min-h-[140px] relative z-10">
                {nodeNames.length === 0 ? (
                    <div className="text-sm text-muted-foreground/70 italic text-center p-6 border border-dashed border-border/40 rounded-lg bg-black/10">
                        Add nodes to select gateways
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2.5">
                        {nodeNames.map((name) => {
                            const isGateway = gatewayNodeNames.includes(name);
                            return (
                                <Badge
                                    key={name}
                                    variant={isGateway ? "default" : "outline"}
                                    className={`cursor-pointer px-3 py-1.5 text-xs font-medium transition-all ${isGateway
                                        ? "bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] border-amber-400"
                                        : "hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 border-border/60 bg-black/20"
                                        }`}
                                    onClick={() => toggleGateway(name)}
                                >
                                    {name}
                                </Badge>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
