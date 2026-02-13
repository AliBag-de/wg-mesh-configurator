"use client";

import { useMeshStore } from "@/lib/store";
import { ProvisioningPanel } from "@/components/features/ProvisioningPanel";
import { DashboardLayout } from "@/components/features/DashboardLayout";
import { x25519 } from "@noble/curves/ed25519";
import { GeneratePayload } from "@/lib/types";
import { toast } from "sonner";
import { useState } from "react";

function toBase64(arr: Uint8Array) {
    return btoa(String.fromCharCode(...arr));
}

export default function ProvisioningPage() {
    const {
        nodes,
        clients,
        networkCidr,
        endpointVersion,
        interfaceName,
        persistentKeepalive,
        includeIpForwarding,
        enableBabel,
        autoGenerateKeys,
        gatewayNodeNames,
        setNodes,
        setClients,
        setGatewayNodeNames,
        resetAll,
    } = useMeshStore();

    const [busy, setBusy] = useState(false);

    // Re-implementing necessary actions for Sidebar props (or minimal stubs)
    // For simplicity, we reuse the store actions but we might disable "Generate Keys" 
    // if this page is purely for provisioning. However, to keep Sidebar happy:

    const updateNode = (id: string, patch: Partial<(typeof nodes)[0]>) => {
        setNodes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, ...patch } : n))
        );
    };

    const generateNodeKeys = (id: string) => {
        const priv = x25519.utils.randomPrivateKey();
        const pub = x25519.getPublicKey(priv);
        updateNode(id, {
            privateKey: toBase64(priv),
            publicKey: toBase64(pub),
        });
    };

    const updateClient = (id: string, patch: Partial<(typeof clients)[0]>) => {
        setClients((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
        );
    };

    const generateClientKeys = (id: string) => {
        const priv = x25519.utils.randomPrivateKey();
        const pub = x25519.getPublicKey(priv);
        updateClient(id, {
            privateKey: toBase64(priv),
            publicKey: toBase64(pub),
        });
    };

    const fillGeneratedKeys = () => {
        nodes.forEach((node) => {
            if (!node.privateKey || !node.publicKey) {
                generateNodeKeys(node.id);
            }
        });
        clients.forEach((client) => {
            if (!client.privateKey || !client.publicKey) {
                generateClientKeys(client.id);
            }
        });
    };

    const handleSubmit = async () => {
        setBusy(true);
        try {
            const payload: GeneratePayload = {
                networkCidr,
                interfaceName,
                endpointVersion,
                persistentKeepalive,
                includeIpForwarding,
                enableBabel,
                autoGenerateKeys,
                nodes,
                clients,
                gatewayNodeNames,
            };

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || "Generation failed");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "wireguard-mesh.zip";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("Configuration generated successfully!");
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setBusy(false);
        }
    };

    const resetForm = () => {
        if (confirm("All settings will be reset. Are you sure?")) {
            resetAll();
        }
    };

    const sidebarProps = {
        nodesCount: nodes.length,
        clientsCount: clients.length,
        gatewayCount: gatewayNodeNames.length,
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
    };

    return (
        <DashboardLayout sidebarProps={sidebarProps}>
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <h2 className="text-2xl font-bold tracking-tight">Provisioning Dashboard</h2>
                </div>
                <div className="flex-1 min-h-0">
                    <ProvisioningPanel />
                </div>
            </div>
        </DashboardLayout>
    );
}
