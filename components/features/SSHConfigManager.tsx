"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMeshStore } from "@/lib/store";
import {
    Key,
    FileText,
    ShieldCheck,
    X,
    Plus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SSHConfigManager() {
    const { sshHosts, setSshHosts, sshKeys, setSshKeys } = useMeshStore();
    const configInputRef = useRef<HTMLInputElement>(null);
    const keyInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleConfigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            const content = await file.text();
            const lines = content.split("\n");
            const hosts: any[] = [];
            let currentHost: any = null;

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) return;

                const [key, ...rest] = trimmed.split(/\s+/);
                const value = rest.join(" ").trim();

                if (key.toLowerCase() === "host") {
                    if (currentHost && currentHost.host && !currentHost.host.includes("*") && !currentHost.host.includes("?")) {
                        hosts.push(currentHost);
                    }
                    currentHost = { host: value };
                } else if (currentHost) {
                    if (key.toLowerCase() === "hostname") currentHost.hostname = value;
                    else if (key.toLowerCase() === "user") currentHost.user = value;
                    else if (key.toLowerCase() === "port") currentHost.port = parseInt(value, 10);
                }
            });

            if (currentHost && currentHost.host && !currentHost.host.includes("*") && !currentHost.host.includes("?")) {
                hosts.push(currentHost);
            }

            // Deduplicate by host name
            const uniqueHosts = Array.from(new Map(hosts.map(h => [h.host, h])).values());

            setSshHosts(uniqueHosts);
            toast.success(`Parsed ${uniqueHosts.length} hosts from SSH config`);
        } catch (err) {
            toast.error("Failed to parse SSH config");
        } finally {
            setIsProcessing(false);
            if (configInputRef.current) configInputRef.current.value = "";
        }
    };

    const handleKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        try {
            const newKeys: Record<string, string> = {};
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const content = await file.text();
                // Simple validation to check if it looks like a private key
                if (content.includes("BEGIN") && content.includes("PRIVATE KEY")) {
                    newKeys[file.name] = content;
                } else {
                    toast.warning(`File ${file.name} does not look like a private key. Skipped.`);
                }
            }

            setSshKeys((prev) => ({ ...prev, ...newKeys }));
            if (Object.keys(newKeys).length > 0) {
                toast.success(`Uploaded ${Object.keys(newKeys).length} SSH keys`);
            }
        } catch (err) {
            toast.error("Failed to upload SSH keys");
        } finally {
            setIsProcessing(false);
            if (keyInputRef.current) keyInputRef.current.value = "";
        }
    };

    const removeKey = (name: string) => {
        setSshKeys((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    };

    const keyCount = Object.keys(sshKeys).length;

    return (
        <div className="space-y-4 px-2 py-3 bg-secondary/10 rounded-lg border border-border/40">
            <div className="space-y-3">
                {/* Status Badge inside content */}
                {sshHosts.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full w-fit">
                        <ShieldCheck className="h-3 w-3 text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                            {sshHosts.length} Hosts Active
                        </span>
                    </div>
                )}

                {/* Config Upload */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        SSH Config File
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={configInputRef}
                            onChange={handleConfigUpload}
                            className="hidden"
                            accept=".config,config,*"
                        />
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-9 border-border/40 bg-black/20 hover:bg-black/40 text-xs font-medium"
                            onClick={() => configInputRef.current?.click()}
                            disabled={isProcessing}
                        >
                            <FileText className="h-3.5 w-3.5 text-blue-400" />
                            {sshHosts.length > 0 ? "Change .ssh/config" : "Upload .ssh/config"}
                        </Button>
                    </div>
                </div>

                {/* Keys Upload */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        Private Keys
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={keyInputRef}
                            onChange={handleKeyUpload}
                            className="hidden"
                            multiple
                        />
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-9 border-border/40 bg-black/20 hover:bg-black/40 text-xs font-medium"
                            onClick={() => keyInputRef.current?.click()}
                            disabled={isProcessing}
                        >
                            <Plus className="h-3.5 w-3.5 text-blue-400" />
                            Add Private Keys
                        </Button>
                    </div>
                </div>

                {/* Key List */}
                {keyCount > 0 && (
                    <div className="space-y-1 mt-2">
                        {Object.keys(sshKeys).map((name) => (
                            <div key={name} className="flex items-center justify-between bg-black/20 border border-border/20 rounded px-2 py-1.5 group/item">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Key className="h-3 w-3 text-blue-400 shrink-0" />
                                    <span className="text-[11px] truncate text-foreground/80 font-mono">
                                        {name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeKey(name)}
                                    className="text-muted-foreground hover:text-red-400 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-2 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground/50 italic leading-snug">
                    Credentials are held in browser memory only and never persisted.
                </p>
            </div>
        </div>
    );
}
