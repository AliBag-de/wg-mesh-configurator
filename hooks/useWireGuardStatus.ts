import { useEffect, useState } from "react";

interface PeerStatus {
    publicKey: string;
    preSharedKey: string;
    endpoint: string;
    allowedIps: string;
    latestHandshake: number;
    transferRx: number;
    transferTx: number;
    persistentKeepalive: string;
}

export function useWireGuardStatus(interfaceName: string = "wg0") {
    const [status, setStatus] = useState<Record<string, PeerStatus>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/status?interface=${interfaceName}`);
                if (!res.ok) throw new Error("Failed to fetch status");
                const data = await res.json();
                if (mounted) {
                    setStatus(data);
                    setError(null);
                }
            } catch (err) {
                if (mounted) {
                    console.error(err);
                    // Don't set error state to avoid flashing errors on temporary failures
                    // setError(err instanceof Error ? err.message : "Unknown error");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        // Initial fetch
        fetchStatus();

        // Poll every 5 seconds
        const interval = setInterval(fetchStatus, 5000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [interfaceName]);

    return { status, loading, error };
}
