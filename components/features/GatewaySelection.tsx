import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface GatewaySelectionProps {
    nodeNames: string[];
    gatewayNodeNames: string[];
    toggleGateway: (name: string) => void;
}

export function GatewaySelection({
    nodeNames,
    gatewayNodeNames,
    toggleGateway,
}: GatewaySelectionProps) {
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/10">
                <div className="flex flex-row items-center gap-2">
                    <div className="h-4 w-4 text-primary flex items-center justify-center border border-primary/50 rounded-full text-[10px]">2</div>
                    <CardTitle className="text-sm font-semibold">Gateway Selection</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {nodeNames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
                        <div className="p-2 rounded-full bg-muted/20">
                            <span className="text-xl">🔍</span>
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                            No nodes available.<br /> Add nodes to configure gateways.
                        </p>
                    </div>
                ) : (
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
                        {nodeNames.map((name) => {
                            const isSelected = gatewayNodeNames.includes(name);
                            return (
                                <div
                                    key={`gw-${name}`}
                                    onClick={() => toggleGateway(name)}
                                    className={`
                                        group flex items-center space-x-3 rounded-md border p-2 cursor-pointer transition-all duration-200
                                        ${isSelected
                                            ? "bg-primary/5 border-primary shadow-sm"
                                            : "bg-card hover:bg-muted/50 border-transparent hover:border-border"
                                        }
                                    `}
                                >
                                    <Checkbox
                                        id={`gw-chk-${name}`}
                                        checked={isSelected}
                                        onChange={() => toggleGateway(name)}
                                        className={`transition-colors h-4 w-4 ${isSelected ? "border-primary" : "border-muted-foreground/30"}`}
                                    />
                                    <Label
                                        htmlFor={`gw-chk-${name}`}
                                        className={`text-xs font-medium cursor-pointer flex-1 ${isSelected ? "text-primary" : "text-foreground"}`}
                                    >
                                        {name}
                                    </Label>
                                    {isSelected && (
                                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-medium">
                                            Gateway
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
