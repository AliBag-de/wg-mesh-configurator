"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBytes, cn } from "@/lib/utils";
import { Peer } from "@/lib/provisioning/contracts";
import { RefreshCw, Server, Plus, Trash2, Play, RotateCcw, CheckCircle2, Activity, ArrowUp, ArrowDown, Clock, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { generateKeypair } from "@/lib/wg-utils";
import { parseCidr, intToIp } from "@/lib/ip-utils";
import { useMeshStore } from "@/lib/store";
import { NodeInput, ClientInput } from "@/lib/types";

type InterfaceSummary = {
  name: string;
  isUp: boolean;
  listenPort: number;
  peerCount: number;
  lastSyncAt: string;
};

type RuntimeStats = {
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
};

type InterfaceDetails = {
  interface: {
    name: string;
    isUp: boolean;
    listenPort: number;
    addressCidr: string;
    revision: number;
    publicKey?: string;
    privateKey?: string;
    fwmark?: number;
    mtu?: number;
    dns?: string;
    table?: string;
  };
  system?: {
    hostname: string;
    version: string;
  };
  peers: Array<Peer & { runtime: RuntimeStats }>;
};

type DryRunResult = {
  currentRevision: number;
  nextRevision: number;
  plan: string[];
  summary: {
    added: number;
    updated: number;
    toggled: number;
    removed: number;
  };
};

type ApplyOperation =
  | { op: "add"; peer: Peer }
  | { op: "update"; peerId: string; patch: Partial<Pick<Peer, "name" | "allowedIps" | "endpoint" | "persistentKeepalive">> }
  | { op: "toggle"; peerId: string; isActive: boolean }
  | { op: "remove"; peerId: string };

function toAllowedIps(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toAllowedIpsText(value: string[]): string {
  return value.join(", ");
}

function uuidv4() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isSameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function formatRelativeTime(timestamp: number) {
  if (!timestamp || timestamp <= 0) return "Never";

  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    const error = new Error(payload?.error?.message || `Request failed: ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return payload.data as T;
}

function buildOperations(interfaceName: string, serverPeers: Peer[], draftPeers: Peer[]): ApplyOperation[] {
  const ops: ApplyOperation[] = [];
  const serverMap = new Map(serverPeers.map((peer) => [peer.peerId, peer]));
  const draftMap = new Map(draftPeers.map((peer) => [peer.peerId, peer]));

  for (const peer of draftPeers) {
    const normalized: Peer = {
      ...peer,
      interface: interfaceName,
      name: peer.name.trim(),
      publicKey: peer.publicKey.trim(),
      endpoint: peer.endpoint?.trim() || undefined,
      allowedIps: peer.allowedIps.map((ip: string) => ip.trim()).filter(Boolean),
      persistentKeepalive:
        peer.persistentKeepalive === undefined || Number.isNaN(peer.persistentKeepalive)
          ? undefined
          : peer.persistentKeepalive
    };

    const existing = serverMap.get(peer.peerId);
    if (!existing) {
      ops.push({ op: "add", peer: normalized });
      continue;
    }

    const patch: Partial<Pick<Peer, "name" | "allowedIps" | "endpoint" | "persistentKeepalive">> = {};
    if (existing.name !== normalized.name) patch.name = normalized.name;
    if (!isSameStringArray(existing.allowedIps, normalized.allowedIps)) patch.allowedIps = normalized.allowedIps;
    if ((existing.endpoint || undefined) !== (normalized.endpoint || undefined)) patch.endpoint = normalized.endpoint;
    if ((existing.persistentKeepalive ?? undefined) !== (normalized.persistentKeepalive ?? undefined)) {
      patch.persistentKeepalive = normalized.persistentKeepalive;
    }

    if (Object.keys(patch).length > 0) {
      ops.push({ op: "update", peerId: normalized.peerId, patch });
    }
    if (existing.isActive !== normalized.isActive) {
      ops.push({ op: "toggle", peerId: normalized.peerId, isActive: normalized.isActive });
    }
  }

  for (const peer of serverPeers) {
    if (!draftMap.has(peer.peerId)) {
      ops.push({ op: "remove", peerId: peer.peerId });
    }
  }

  return ops;
}

export function ProvisioningPanel() {
  const [interfaces, setInterfaces] = useState<InterfaceSummary[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [details, setDetails] = useState<InterfaceDetails | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [serverPeers, setServerPeers] = useState<Peer[]>([]);
  const [draftPeers, setDraftPeers] = useState<Peer[]>([]);
  const [runtimeByKey, setRuntimeByKey] = useState<Record<string, RuntimeStats>>({});
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Array<{ id: string; at: string; action: string; peerId?: string }>>([]);

  const meshNodes = useMeshStore((state: any) => state.nodes);
  const meshClients = useMeshStore((state: any) => state.clients);
  const meshNode = useMemo(() =>
    meshNodes.find((n: NodeInput) => n.name === selectedInterface),
    [meshNodes, selectedInterface]
  );

  const peersWithMeta = useMemo(() => {
    return draftPeers.map((peer: Peer) => {
      const dNode = meshNodes.find((n: NodeInput) => n.publicKey === peer.publicKey || n.name === peer.name);
      const dClient = meshClients.find((c: ClientInput) => c.publicKey === peer.publicKey || c.name === peer.name);
      return {
        ...peer,
        designMeta: dNode ? { type: "Node", name: dNode.name } : dClient ? { type: "Client", name: dClient.name } : null
      };
    });
  }, [draftPeers, meshNodes, meshClients]);

  const operations = useMemo(
    () => (selectedInterface ? buildOperations(selectedInterface, serverPeers, draftPeers) : []),
    [selectedInterface, serverPeers, draftPeers]
  );

  const loadInterfaces = async () => {
    const data = await apiRequest<{ interfaces: InterfaceSummary[] }>("/api/interfaces");
    setInterfaces(data.interfaces);
    if (!selectedInterface && data.interfaces.length > 0) {
      setSelectedInterface(data.interfaces[0].name);
    }
  };

  const loadDetails = async (name: string) => {
    const data = await apiRequest<InterfaceDetails>(`/api/interface/${encodeURIComponent(name)}`);
    const peers = data.peers.map((peer: any) => {
      const { runtime, ...rest } = peer;
      return rest;
    });

    const runtimeMap: Record<string, RuntimeStats> = {};
    data.peers.forEach((peer: any) => {
      runtimeMap[peer.publicKey] = peer.runtime;
    });

    setDetails(data);
    setServerPeers(peers);
    setDraftPeers(peers.map((peer: Peer) => ({ ...peer })));
    setRuntimeByKey(runtimeMap);
    setDryRun(null);
  };

  const loadAudit = async (name: string) => {
    const data = await apiRequest<{ items: Array<{ id: string; at: string; action: string; peerId?: string }> }>(
      `/api/interface/${encodeURIComponent(name)}/audit?limit=20`
    );
    setAudit(data.items);
  };

  useEffect(() => {
    loadInterfaces().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load interfaces");
    });
  }, []);

  useEffect(() => {
    if (!selectedInterface) return;
    Promise.all([loadDetails(selectedInterface), loadAudit(selectedInterface)]).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load interface details");
    });
  }, [selectedInterface]);

  const updateDraftPeer = (peerId: string, patch: Partial<Peer>) => {
    setDraftPeers((prev: Peer[]) => prev.map((peer: Peer) => (peer.peerId === peerId ? { ...peer, ...patch } : peer)));
  };

  const removeDraftPeer = (peerId: string) => {
    setDraftPeers((prev: Peer[]) => prev.filter((peer: Peer) => peer.peerId !== peerId));
  };

  const addDraftPeer = () => {
    if (!selectedInterface || !details) return;

    // 1. Generate keys
    const keys = generateKeypair();

    // 2. Assign IP
    let nextIp = "10.20.0.2/32";
    try {
      const parsed = parseCidr(details.interface.addressCidr);
      const usedIps = new Set(draftPeers.flatMap((p: Peer) => p.allowedIps.map((ip: string) => ip.split("/")[0])));

      const [ifaceAddr] = details.interface.addressCidr.split("/");
      if (ifaceAddr) usedIps.add(ifaceAddr);

      for (let i = 2; i < parsed.size - 1; i += 1) {
        const candidate = intToIp(parsed.base + i);
        if (!usedIps.has(candidate)) {
          nextIp = `${candidate}/32`;
          break;
        }
      }
    } catch (e) {
      console.error("Failed to calculate next IP", e);
    }

    setDraftPeers((prev: Peer[]) => [
      ...prev,
      {
        peerId: crypto.randomUUID(),
        name: `peer-${prev.length + 1}`,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        allowedIps: [nextIp],
        endpoint: "",
        persistentKeepalive: 25,
        isActive: true,
        interface: selectedInterface
      }
    ]);
  };

  const validateDraft = () => {
    for (const peer of draftPeers) {
      if (!peer.name.trim()) throw new Error("Peer name cannot be empty.");
      if (!peer.publicKey.trim()) throw new Error(`Public key is required for ${peer.name}.`);
      if (!peer.allowedIps.length || peer.allowedIps.some((ip) => !ip.trim())) {
        throw new Error(`Allowed IPs is required for ${peer.name}.`);
      }
    }
  };

  const withConflictRefresh = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 409 && selectedInterface) {
        toast.error("Revision conflict detected. Data is refreshing.");
        await loadDetails(selectedInterface);
        await loadAudit(selectedInterface);
        return;
      }
      throw error;
    }
  };

  const runDryRun = async () => {
    if (!selectedInterface || !details) return;
    validateDraft();
    if (operations.length === 0) {
      toast.message("No changes to preview.");
      setDryRun(null);
      return;
    }

    setBusy(true);
    try {
      const data = await apiRequest<DryRunResult>(
        `/api/interface/${encodeURIComponent(selectedInterface)}/peers/apply`,
        {
          method: "POST",
          body: JSON.stringify({
            revision: details.interface.revision,
            dryRun: true,
            operations
          })
        }
      );
      setDryRun(data);
      toast.success("Dry-run plan created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dry-run failed.");
    } finally {
      setBusy(false);
    }
  };

  const applyChanges = async () => {
    if (!selectedInterface || !details) return;
    validateDraft();
    if (operations.length === 0) {
      toast.message("No changes to apply.");
      return;
    }

    setBusy(true);
    try {
      await withConflictRefresh(async () => {
        await apiRequest(
          `/api/interface/${encodeURIComponent(selectedInterface)}/peers/apply`,
          {
            method: "POST",
            body: JSON.stringify({
              revision: details.interface.revision,
              dryRun: false,
              operations
            })
          }
        );
        await loadDetails(selectedInterface);
        await loadAudit(selectedInterface);
        toast.success("Provisioning changes applied.");
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Apply failed.");
    } finally {
      setBusy(false);
    }
  };

  const runReconcile = async (mode: "state_to_runtime" | "runtime_to_state") => {
    if (!selectedInterface || !details) return;
    setBusy(true);
    try {
      await withConflictRefresh(async () => {
        await apiRequest(
          `/api/interface/${encodeURIComponent(selectedInterface)}/reconcile`,
          {
            method: "POST",
            body: JSON.stringify({
              revision: details.interface.revision,
              mode
            })
          }
        );
        await loadDetails(selectedInterface);
        await loadAudit(selectedInterface);
        toast.success(`Reconcile completed (${mode}).`);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reconcile failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleInterface = async () => {
    if (!selectedInterface || !details) return;
    const next = !details.interface.isUp;
    if (!confirm(`Set interface ${selectedInterface} to ${next ? "UP" : "DOWN"}?`)) {
      return;
    }

    setBusy(true);
    try {
      await withConflictRefresh(async () => {
        await apiRequest(`/api/interface/${encodeURIComponent(selectedInterface)}/toggle`, {
          method: "POST",
          body: JSON.stringify({
            revision: details.interface.revision,
            isUp: next,
            dryRun: false
          })
        });
        await loadDetails(selectedInterface);
        await loadAudit(selectedInterface);
        toast.success(`Interface is now ${next ? "UP" : "DOWN"}.`);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Interface toggle failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4 h-full min-h-0">
      <div className="rounded-lg border bg-card/50 backdrop-blur-sm overflow-hidden min-h-0 flex flex-col">
        <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Interfaces</h3>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadInterfaces()} disabled={busy}>
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
          </Button>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto">
          {interfaces.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3">No interfaces detected.</div>
          ) : (
            interfaces.map((iface) => (
              <button
                key={iface.name}
                className={`w-full text-left rounded-md border p-2 transition-colors ${selectedInterface === iface.name
                  ? "bg-primary/10 border-primary/30"
                  : "bg-card border-transparent hover:border-border hover:bg-muted/40"
                  }`}
                onClick={() => setSelectedInterface(iface.name)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{iface.name}</span>
                  <Badge variant={iface.isUp ? "default" : "outline"} className="text-[10px] h-5">
                    {iface.isUp ? "UP" : "DOWN"}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  Port {iface.listenPort} • Peers {iface.peerCount}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card/50 backdrop-blur-sm overflow-hidden min-h-0 flex flex-col">
        {!details ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Server className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No Interface Selected</h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-1">
              Select a WireGuard interface from the sidebar to view details and manage peers.
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b bg-muted/5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Interface</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm font-mono px-2 py-0.5 bg-background shadow-sm border-primary/20">
                        {details.interface.name}
                      </Badge>
                      <div className="flex items-center gap-1.5 ml-1">
                        <div className={cn("h-2 w-2 rounded-full shadow-sm", details.interface.isUp ? "bg-emerald-500 animate-pulse" : "bg-zinc-400")} />
                        <span className="text-[10px] font-semibold text-muted-foreground">{details.interface.isUp ? "ACTIVE" : "DOWN"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Address</span>
                    <span className="text-sm font-mono font-medium">{details.interface.addressCidr}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Listen Port</span>
                    <span className="text-sm font-mono font-medium">{details.interface.listenPort || "Auto"}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Active Peers</span>
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-primary/60" />
                      <span className="text-sm font-bold">{serverPeers.filter(p => p.isActive).length} / {serverPeers.length}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-9 font-semibold shadow-sm" onClick={() => loadDetails(selectedInterface!)} disabled={busy}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", busy && "animate-spin")} />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/40">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Public Key</span>
                  <div className="flex items-center gap-2 group">
                    <span className="text-[11px] font-mono bg-muted/30 px-2 py-0.5 rounded border border-border/50 truncate flex-1 outline-none">
                      {details.interface.publicKey || "Unknown"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        if (details.interface.publicKey) {
                          navigator.clipboard.writeText(details.interface.publicKey);
                          toast.success("Public Key copied");
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Private Key</span>
                  <div className="flex items-center gap-2 group">
                    <span className="text-[11px] font-mono bg-muted/30 px-2 py-0.5 rounded border border-border/50 truncate flex-1">
                      {details.interface.privateKey || "••••••••••••"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Listen Port / MTU</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-medium">{details.interface.listenPort || "Auto"}</span>
                    {details.interface.mtu && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/50">MTU</span>
                        <span className="text-[11px] font-mono font-medium">{details.interface.mtu}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">DNS / Table</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-medium truncate max-w-[100px]" title={details.interface.dns}>
                      {details.interface.dns || "—"}
                    </span>
                    {details.interface.table && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-[11px] font-mono font-medium">{details.interface.table}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">System Host</span>
                  <div className="flex items-center gap-2">
                    <Server className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[11px] font-medium">{details.system?.hostname || "Unknown"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">WG Version</span>
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[11px] font-medium truncate" title={details.system?.version}>
                      {details.system?.version?.split("\n")[0] || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interface Actions</h3>
                {meshNode && (
                  <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-700 border-blue-500/20">
                    Managed by Mesh
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !selectedInterface} onClick={toggleInterface}>
                  <Play className="h-3 w-3 mr-1.5" />
                  {details.interface.isUp ? "Set Down" : "Set Up"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !selectedInterface} onClick={() => runReconcile("state_to_runtime")}>
                  <CheckCircle2 className="h-3 w-3 mr-1.5" />
                  Reconcile (Push)
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !selectedInterface} onClick={() => runReconcile("runtime_to_state")}>
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Import (Pull)
                </Button>
              </div>
            </div>

            <div className="p-3 border-b bg-muted/5 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Pending ops: <span className="font-mono text-foreground">{operations.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !details} onClick={addDraftPeer}>
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Peer
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !details} onClick={() => setDraftPeers(serverPeers.map((peer) => ({ ...peer })))}>
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Discard
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !details} onClick={runDryRun}>
                  Dry Run
                </Button>
                <Button size="sm" className="h-7 text-xs" disabled={busy || !details} onClick={applyChanges}>
                  Apply
                </Button>
              </div>
            </div>

            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/10 text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-3 py-3 w-10 text-center">On</th>
                    <th className="px-3 py-3 w-44">Name</th>
                    <th className="px-3 py-3">Public Key</th>
                    <th className="px-3 py-3">Allowed IPs</th>
                    <th className="px-3 py-3">Endpoint</th>
                    <th className="px-3 py-3 w-24">Keepalive</th>
                    <th className="px-3 py-3 w-32">Handshake</th>
                    <th className="px-3 py-3 w-32">Transfer</th>
                    <th className="px-3 py-3 w-16 text-right">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {peersWithMeta.map((peer, index) => {
                    const stats = runtimeByKey[peer.publicKey] || { latestHandshake: 0, transferRx: 0, transferTx: 0 };
                    const existing = serverPeers.some((item) => item.peerId === peer.peerId);
                    return (
                      <tr key={peer.peerId} className={`hover:bg-muted/10 ${peer.isUnmanaged ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2 text-center">
                          <Checkbox
                            checked={peer.isActive}
                            disabled={peer.isUnmanaged}
                            onChange={(e) => updateDraftPeer(peer.peerId, { isActive: e.target.checked })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <div className={cn(
                                  "absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shadow-sm z-10",
                                  stats.latestHandshake > Date.now() / 1000 - 180 ? "bg-emerald-500 shadow-emerald-500/50" : "bg-zinc-300"
                                )} />
                                <Input
                                  value={peer.name}
                                  disabled={peer.isUnmanaged}
                                  onChange={(e) => updateDraftPeer(peer.peerId, { name: e.target.value })}
                                  className="h-7 text-xs bg-background/50 border-transparent focus:border-primary/50 pl-5 w-full font-medium"
                                />
                              </div>
                              {peer.designMeta && (
                                <Badge variant="outline" className="text-[9px] h-3.5 bg-green-500/10 text-green-700 border-green-500/20 px-1 whitespace-nowrap">
                                  {peer.designMeta.type}
                                </Badge>
                              )}
                            </div>
                            {peer.isUnmanaged && (
                              <Badge variant="outline" className="w-fit text-[9px] h-4 bg-amber-500/10 text-amber-700 border-amber-500/20">Unmanaged</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={peer.publicKey}
                            onChange={(e) => updateDraftPeer(peer.peerId, { publicKey: e.target.value })}
                            disabled={existing || peer.isUnmanaged}
                            className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={toAllowedIpsText(peer.allowedIps)}
                            disabled={peer.isUnmanaged}
                            onChange={(e) => updateDraftPeer(peer.peerId, { allowedIps: toAllowedIps(e.target.value) })}
                            className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={peer.endpoint || ""}
                            disabled={peer.isUnmanaged}
                            onChange={(e) => updateDraftPeer(peer.peerId, { endpoint: e.target.value })}
                            className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={peer.persistentKeepalive ?? ""}
                            disabled={peer.isUnmanaged}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateDraftPeer(peer.peerId, {
                                persistentKeepalive: value === "" ? undefined : Number(value)
                              });
                            }}
                            className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                            <span className={cn(
                              "font-mono text-[11px]",
                              stats.latestHandshake > Date.now() / 1000 - 180 ? "text-emerald-600 font-semibold" : "text-muted-foreground"
                            )}>
                              {formatRelativeTime(stats.latestHandshake)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1 justify-center min-h-[40px]">
                            <div className="flex items-center gap-1.5">
                              <ArrowDown className="h-3 w-3 text-emerald-600/70" />
                              <span className="text-emerald-700/90 font-mono text-[10px]">{formatBytes(stats.transferRx)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <ArrowUp className="h-3 w-3 text-blue-600/70" />
                              <span className="text-blue-700/90 font-mono text-[10px]">{formatBytes(stats.transferTx)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!peer.isUnmanaged && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeDraftPeer(peer.peerId)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t bg-muted/5 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-md border bg-background/40 p-2 min-h-[96px]">
                <div className="text-[11px] text-muted-foreground mb-1">Dry Run Plan</div>
                {dryRun ? (
                  <pre className="text-[10px] font-mono whitespace-pre-wrap break-words">{dryRun.plan.join("\n") || "No runtime commands."}</pre>
                ) : (
                  <div className="text-[10px] text-muted-foreground">Run dry-run to preview runtime commands.</div>
                )}
              </div>
              <div className="rounded-md border bg-background/40 p-2 min-h-[96px]">
                <div className="text-[11px] text-muted-foreground mb-1">Recent Audit</div>
                {audit.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground">No audit entries.</div>
                ) : (
                  <div className="space-y-1">
                    {audit.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="text-[10px] font-mono text-muted-foreground">
                        {new Date(entry.at).toLocaleTimeString()} • {entry.action}{entry.peerId ? ` • ${entry.peerId.slice(0, 8)}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
