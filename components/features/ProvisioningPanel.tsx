"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBytes } from "@/lib/utils";
import { Peer } from "@/lib/provisioning/contracts";
import { RefreshCw, Server, Plus, Trash2, Play, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

function isSameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
      allowedIps: peer.allowedIps.map((ip) => ip.trim()).filter(Boolean),
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
  const [selectedInterface, setSelectedInterface] = useState<string>("");
  const [details, setDetails] = useState<InterfaceDetails | null>(null);
  const [serverPeers, setServerPeers] = useState<Peer[]>([]);
  const [draftPeers, setDraftPeers] = useState<Peer[]>([]);
  const [runtimeByKey, setRuntimeByKey] = useState<Record<string, RuntimeStats>>({});
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Array<{ id: string; at: string; action: string; peerId?: string }>>([]);

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
    const peers = data.peers.map((peer) => {
      const { runtime, ...rest } = peer;
      return rest;
    });

    const runtimeMap: Record<string, RuntimeStats> = {};
    data.peers.forEach((peer) => {
      runtimeMap[peer.publicKey] = peer.runtime;
    });

    setDetails(data);
    setServerPeers(peers);
    setDraftPeers(peers.map((peer) => ({ ...peer })));
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
    setDraftPeers((prev) => prev.map((peer) => (peer.peerId === peerId ? { ...peer, ...patch } : peer)));
  };

  const removeDraftPeer = (peerId: string) => {
    setDraftPeers((prev) => prev.filter((peer) => peer.peerId !== peerId));
  };

  const addDraftPeer = () => {
    if (!selectedInterface) return;
    setDraftPeers((prev) => [
      ...prev,
      {
        peerId: crypto.randomUUID(),
        name: `peer-${prev.length + 1}`,
        publicKey: "",
        allowedIps: ["10.20.0.250/32"],
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
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto">
          {interfaces.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3">No interfaces detected.</div>
          ) : (
            interfaces.map((iface) => (
              <button
                key={iface.name}
                className={`w-full text-left rounded-md border p-2 transition-colors ${
                  selectedInterface === iface.name
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
        <div className="p-3 border-b bg-muted/20 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Dynamic Provisioning</h3>
            <div className="text-[10px] text-muted-foreground font-mono">
              {details ? `${details.interface.name} • rev ${details.interface.revision} • ${details.interface.addressCidr}` : "Select interface"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !selectedInterface} onClick={toggleInterface}>
              <Play className="h-3 w-3 mr-1.5" />
              {details?.interface.isUp ? "Set Down" : "Set Up"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !selectedInterface} onClick={() => runReconcile("state_to_runtime")}>
              <CheckCircle2 className="h-3 w-3 mr-1.5" />
              Reconcile
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
          {!details ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Select an interface to manage provisioning.</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/10 text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-10 text-center">On</th>
                  <th className="px-3 py-2 w-44">Name</th>
                  <th className="px-3 py-2">Public Key</th>
                  <th className="px-3 py-2">Allowed IPs</th>
                  <th className="px-3 py-2">Endpoint</th>
                  <th className="px-3 py-2 w-24">Keepalive</th>
                  <th className="px-3 py-2 w-32">Transfer</th>
                  <th className="px-3 py-2 w-16 text-right">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {draftPeers.map((peer, index) => {
                  const stats = runtimeByKey[peer.publicKey] || { latestHandshake: 0, transferRx: 0, transferTx: 0 };
                  const existing = serverPeers.some((item) => item.peerId === peer.peerId);
                  return (
                    <tr key={peer.peerId} className="hover:bg-muted/10">
                      <td className="px-3 py-2 text-center font-mono text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2 text-center">
                        <Checkbox
                          checked={peer.isActive}
                          onChange={(e) => updateDraftPeer(peer.peerId, { isActive: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={peer.name}
                          onChange={(e) => updateDraftPeer(peer.peerId, { name: e.target.value })}
                          className="h-7 text-xs bg-background/50 border-transparent focus:border-primary/50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={peer.publicKey}
                          onChange={(e) => updateDraftPeer(peer.peerId, { publicKey: e.target.value })}
                          disabled={existing}
                          className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={toAllowedIpsText(peer.allowedIps)}
                          onChange={(e) => updateDraftPeer(peer.peerId, { allowedIps: toAllowedIps(e.target.value) })}
                          className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={peer.endpoint || ""}
                          onChange={(e) => updateDraftPeer(peer.peerId, { endpoint: e.target.value })}
                          className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={peer.persistentKeepalive ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateDraftPeer(peer.peerId, {
                              persistentKeepalive: value === "" ? undefined : Number(value)
                            });
                          }}
                          className="h-7 text-xs font-mono bg-background/50 border-transparent focus:border-primary/50"
                        />
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="text-green-600/80">↓ {formatBytes(stats.transferRx)}</span>
                          <span className="text-blue-600/80">↑ {formatBytes(stats.transferTx)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDraftPeer(peer.peerId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
      </div>
    </div>
  );
}

