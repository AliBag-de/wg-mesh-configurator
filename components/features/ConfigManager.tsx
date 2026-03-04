"use client";

import { useMeshStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Download, Upload, AlertCircle } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

export function ConfigManager() {
    const store = useMeshStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        try {
            store.ensureKeys();
            // We need to fetch the latest state since the store might have been updated by ensureKeys
            const currentState = useMeshStore.getState();
            const state = {
                networkCidr: currentState.networkCidr,
                endpointVersion: currentState.endpointVersion,
                interfaceName: currentState.interfaceName,
                persistentKeepalive: currentState.persistentKeepalive,
                includeIpForwarding: currentState.includeIpForwarding,
                enableBabel: currentState.enableBabel,
                autoGenerateKeys: currentState.autoGenerateKeys,
                nodes: currentState.nodes,
                clients: currentState.clients,
                mtu: currentState.mtu,
                version: "1.0",
                timestamp: new Date().toISOString(),
            };

            const blob = new Blob([JSON.stringify(state, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `wg-mesh-config-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success("Configuration exported successfully");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export configuration");
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                if (!data.nodes || !Array.isArray(data.nodes)) {
                    throw new Error("Invalid configuration file: Missing nodes array");
                }
                store.importMeshState(data);
                toast.success("Configuration imported successfully");
            } catch (error: any) {
                console.error("Import failed:", error);
                toast.error(error.message || "Failed to import configuration");
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-4 px-2 py-3 bg-secondary/10 rounded-lg border border-border/40">
            <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                Save your entire mesh configuration to a JSON file for backup or sharing.
            </p>

            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-primary/20 hover:bg-primary/5 flex items-center gap-2"
                    onClick={handleExport}
                >
                    <Download className="h-3.5 w-3.5" />
                    Export
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-blue-500/20 hover:bg-blue-500/5 text-blue-400"
                    onClick={handleImportClick}
                >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                </Button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json,application/json"
                onChange={handleFileChange}
            />

            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-200/70">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Importing will overwrite your current dashboard state.</span>
            </div>
        </div>
    );
}
