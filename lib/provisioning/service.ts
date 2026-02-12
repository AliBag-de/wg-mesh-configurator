import { randomUUID } from "crypto";
import {
  ApplyPeersRequest,
  AuditQuery,
  Peer,
  ReconcileRequest,
  ToggleInterfaceRequest
} from "./contracts";
import { StateManager, PersistedState } from "./repository";
import { WireGuardAdapter } from "./adapter";

const stateManager = new StateManager();
const wgAdapter = new WireGuardAdapter();

type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  peerId?: string;
  meta?: unknown;
};

type StackOp =
  | { type: 'add', peer: Peer }
  | { type: 'remove', peer: Peer }
  | { type: 'update', peer: Peer, previous: Peer };

type RuntimeOp =
  | { type: "add"; peer: Peer }
  | { type: "remove"; peer: Peer }
  | { type: "update"; peer: Peer; previous: Peer };

const auditStore = new Map<string, AuditEntry[]>();

function pushAudit(name: string, entry: Omit<AuditEntry, "id" | "at">) {
  const list = auditStore.get(name) ?? [];
  list.unshift({
    id: `evt_${randomUUID()}`,
    at: new Date().toISOString(),
    ...entry
  });
  auditStore.set(name, list.slice(0, 500));
}

function getPeersForInterface(state: PersistedState, interfaceName: string): Peer[] {
  return state.peers.filter(p => p.interface === interfaceName || (!p.interface && interfaceName === "wg0"));
}

export async function listInterfaces() {
  const state = await stateManager.load();
  return Object.keys(state.interfaces).map(name => {
    const iface = state.interfaces[name];
    const peerCount = getPeersForInterface(state, name).length;
    return {
      name,
      isUp: iface.isUp,
      listenPort: iface.listenPort,
      peerCount,
      lastSyncAt: state.updatedAt
    };
  });
}

export async function getInterfaceDetails(name: string) {
  const state = await stateManager.load();
  const iface = state.interfaces[name];

  if (!iface) throw new Error("Interface not found");

  const { peers: runtimePeers } = await wgAdapter.getInterface(name);
  const runtimeMap = new Map(runtimePeers.map(p => [p.publicKey, p]));

  const peers = getPeersForInterface(state, name).map((peer) => {
    const runtime = runtimeMap.get(peer.publicKey);
    return {
      ...peer,
      runtime: {
        latestHandshake: runtime?.latestHandshake || 0,
        transferRx: runtime?.transferRx || 0,
        transferTx: runtime?.transferTx || 0
      }
    };
  });

  return {
    interface: {
      name: name,
      isUp: iface.isUp,
      listenPort: iface.listenPort,
      addressCidr: iface.addressCidr,
      revision: iface.revision
    },
    peers
  };
}

function assertRevision(currentRevision: number, expectedRevision: number) {
  if (currentRevision !== expectedRevision) {
    const error = new Error("Revision mismatch");
    (error as Error & { code: string; details: unknown }).code = "REVISION_CONFLICT";
    (error as Error & { code: string; details: unknown }).details = {
      expected: currentRevision,
      received: expectedRevision
    };
    throw error;
  }
}

export async function applyPeerOperations(
  name: string,
  input: ApplyPeersRequest
) {
  const initialState = await stateManager.load();
  const ifaceState = initialState.interfaces[name];
  if (!ifaceState) throw new Error("Interface not found");
  assertRevision(ifaceState.revision, input.revision);

  const currentPeers = getPeersForInterface(initialState, name).map((peer) => ({ ...peer }));
  const runtimeOps: RuntimeOp[] = [];
  const auditLog: Omit<AuditEntry, "id" | "at">[] = [];

  let added = 0;
  let updated = 0;
  let toggled = 0;
  let removed = 0;

  for (const operation of input.operations) {
    if (operation.op === "add") {
      const newPeer = { ...operation.peer, interface: name };
      currentPeers.push(newPeer);
      if (newPeer.isActive) {
        runtimeOps.push({ type: "add", peer: newPeer });
      }
      auditLog.push({ actor: "admin", action: "peer.add", peerId: newPeer.peerId, meta: { name: newPeer.name } });
      added++;
      continue;
    }

    const idx = currentPeers.findIndex((p) => p.peerId === operation.peerId);
    if (idx === -1) {
      continue;
    }

    if (operation.op === "update") {
      const previous = { ...currentPeers[idx] };
      const nextPeer = { ...currentPeers[idx], ...operation.patch };
      currentPeers[idx] = nextPeer;
      if (nextPeer.isActive) {
        runtimeOps.push({ type: "update", peer: nextPeer, previous });
      }
      auditLog.push({ actor: "admin", action: "peer.update", peerId: operation.peerId });
      updated++;
      continue;
    }

    if (operation.op === "toggle") {
      currentPeers[idx] = { ...currentPeers[idx], isActive: operation.isActive };
      if (operation.isActive) {
        runtimeOps.push({ type: "add", peer: currentPeers[idx] });
      } else {
        runtimeOps.push({ type: "remove", peer: currentPeers[idx] });
      }
      auditLog.push({ actor: "admin", action: "peer.toggle", peerId: operation.peerId, meta: { isActive: operation.isActive } });
      toggled++;
      continue;
    }

    const peerToRemove = currentPeers[idx];
    currentPeers.splice(idx, 1);
    runtimeOps.push({ type: "remove", peer: peerToRemove });
    auditLog.push({ actor: "admin", action: "peer.remove", peerId: operation.peerId });
    removed++;
  }

  if (input.dryRun) {
    const plan = runtimeOps.map((op) => {
      if (op.type === "remove") {
        return `[REMOVE] wg set ${name} peer ${op.peer.publicKey} remove`;
      }
      return `[${op.type.toUpperCase()}] wg set ${name} peer ${op.peer.publicKey} allowed-ips ${op.peer.allowedIps.join(",")}`;
    });
    return {
      dryRun: true,
      currentRevision: ifaceState.revision,
      nextRevision: ifaceState.revision + 1,
      plan,
      summary: { added, updated, toggled, removed }
    };
  }

  const rollbackStack: StackOp[] = [];
  const rollbackRuntime = async () => {
    for (let i = rollbackStack.length - 1; i >= 0; i--) {
      const op = rollbackStack[i];
      try {
        if (op.type === "add") {
          await wgAdapter.removePeer(name, op.peer.publicKey, { ignoreIfMissing: true });
        } else if (op.type === "remove") {
          await wgAdapter.addPeer(name, op.peer);
        } else if (op.type === "update") {
          await wgAdapter.updatePeer(name, op.previous);
        }
      } catch (rollbackError) {
        console.error("Rollback failed for op", op, rollbackError);
      }
    }
  };

  try {
    for (const op of runtimeOps) {
      if (op.type === "add") {
        await wgAdapter.addPeer(name, op.peer);
        rollbackStack.push({ type: "add", peer: op.peer });
      } else if (op.type === "remove") {
        await wgAdapter.removePeer(name, op.peer.publicKey, { ignoreIfMissing: true });
        rollbackStack.push({ type: "remove", peer: op.peer });
      } else {
        await wgAdapter.updatePeer(name, op.peer);
        rollbackStack.push({ type: "update", peer: op.peer, previous: op.previous });
      }
    }

    const revision = await stateManager.update(async (state) => {
      const iface = state.interfaces[name];
      if (!iface) throw new Error("Interface not found");
      assertRevision(iface.revision, input.revision);

      const otherPeers = state.peers.filter((p) => p.interface !== name && (p.interface || name !== "wg0"));
      state.peers = [...otherPeers, ...currentPeers];
      iface.revision += 1;
      state.updatedAt = new Date().toISOString();
      return iface.revision;
    });

    auditLog.forEach((entry) => pushAudit(name, entry));

    return {
      applied: true,
      revision,
      summary: { added, updated, toggled, removed, failed: 0 }
    };
  } catch (error) {
    await rollbackRuntime();
    throw error;
  }
}

export async function toggleInterfaceState(
  name: string,
  input: ToggleInterfaceRequest
) {
  const state = await stateManager.load();
  const iface = state.interfaces[name];
  if (!iface) throw new Error("Interface not found");
  assertRevision(iface.revision, input.revision);

  if (input.dryRun) {
    return { name, isUp: iface.isUp, revision: iface.revision };
  }

  await wgAdapter.toggleInterface(name, input.isUp);
  try {
    const revision = await stateManager.update(async (lockedState) => {
      const lockedIface = lockedState.interfaces[name];
      if (!lockedIface) throw new Error("Interface not found");
      assertRevision(lockedIface.revision, input.revision);

      lockedIface.isUp = input.isUp;
      lockedIface.revision += 1;
      lockedState.updatedAt = new Date().toISOString();
      return lockedIface.revision;
    });

    pushAudit(name, { actor: "admin", action: "interface.toggle", meta: { isUp: input.isUp } });
    return { name, isUp: input.isUp, revision };
  } catch (error) {
    try {
      await wgAdapter.toggleInterface(name, !input.isUp);
    } catch (rollbackError) {
      console.error("Toggle rollback failed", rollbackError);
    }
    throw error;
  }
}

export async function reconcileInterface(
  name: string,
  input: ReconcileRequest
) {
  const state = await stateManager.load();
  const iface = state.interfaces[name];
  if (!iface) throw new Error("Interface not found");
  assertRevision(iface.revision, input.revision);

  const interfacePeers = getPeersForInterface(state, name);
  const { peers: runtimePeers } = await wgAdapter.getInterface(name);
  const runtimeKeys = new Set(runtimePeers.map((p) => p.publicKey));
  const stateKeys = new Set(interfacePeers.map((p) => p.publicKey));

  const missingInRuntime = interfacePeers.filter((p) => p.isActive && !runtimeKeys.has(p.publicKey));
  const zombies = runtimePeers.filter((p) => !stateKeys.has(p.publicKey));
  const driftFound = missingInRuntime.length > 0 || zombies.length > 0;

  let fixed = 0;
  const rollbackStack: StackOp[] = [];

  if (input.mode === "state_to_runtime") {
    try {
      for (const peer of missingInRuntime) {
        await wgAdapter.addPeer(name, peer);
        rollbackStack.push({ type: "add", peer });
        fixed++;
      }
      for (const zombie of zombies) {
        const syntheticPeer: Peer = {
          peerId: randomUUID(),
          name: `runtime-${zombie.publicKey.slice(0, 8)}`,
          publicKey: zombie.publicKey,
          allowedIps: zombie.allowedIps,
          endpoint: zombie.endpoint,
          persistentKeepalive: zombie.persistentKeepalive,
          isActive: true,
          interface: name
        };
        await wgAdapter.removePeer(name, zombie.publicKey, { ignoreIfMissing: true });
        rollbackStack.push({ type: "remove", peer: syntheticPeer });
        fixed++;
      }
    } catch (error) {
      for (let i = rollbackStack.length - 1; i >= 0; i--) {
        const op = rollbackStack[i];
        try {
          if (op.type === "add") {
            await wgAdapter.removePeer(name, op.peer.publicKey, { ignoreIfMissing: true });
          } else {
            await wgAdapter.addPeer(name, op.peer);
          }
        } catch (rollbackError) {
          console.error("Reconcile rollback failed", rollbackError);
        }
      }
      throw error;
    }
  }

  const revision = await stateManager.update(async (lockedState) => {
    const lockedIface = lockedState.interfaces[name];
    if (!lockedIface) throw new Error("Interface not found");
    assertRevision(lockedIface.revision, input.revision);

    let changed = false;

    if (input.mode === "runtime_to_state") {
      const nextPeers = getPeersForInterface(lockedState, name).map((peer) => ({ ...peer }));
      for (const peer of nextPeers) {
        if (peer.isActive && !runtimeKeys.has(peer.publicKey)) {
          peer.isActive = false;
          fixed++;
          changed = true;
        }
      }
      for (const zombie of zombies) {
        nextPeers.push({
          peerId: randomUUID(),
          name: `runtime-${zombie.publicKey.slice(0, 8)}`,
          publicKey: zombie.publicKey,
          allowedIps: zombie.allowedIps,
          endpoint: zombie.endpoint,
          persistentKeepalive: zombie.persistentKeepalive,
          isActive: true,
          interface: name
        });
        fixed++;
        changed = true;
      }

      const otherPeers = lockedState.peers.filter((p) => p.interface !== name && (p.interface || name !== "wg0"));
      lockedState.peers = [...otherPeers, ...nextPeers];
    } else if (fixed > 0) {
      changed = true;
    }

    if (changed) {
      lockedIface.revision += 1;
      lockedState.updatedAt = new Date().toISOString();
    }
    return lockedIface.revision;
  });

  if (fixed > 0) {
    pushAudit(name, { actor: "admin", action: "interface.reconcile", meta: { mode: input.mode, fixed } });
  }

  return {
    driftFound,
    fixed: fixed > 0,
    revision,
    details: {
      missingInRuntime: missingInRuntime.length,
      extraInRuntime: zombies.length
    }
  };
}

export async function getAudit(name: string, query: AuditQuery) {
  const entries = auditStore.get(name) ?? [];
  const startIndex = query.cursor
    ? Math.max(entries.findIndex((entry) => entry.id === query.cursor), -1) + 1
    : 0;
  const items = entries.slice(startIndex, startIndex + query.limit);
  const next = items.length === query.limit ? items[items.length - 1]?.id : undefined;
  return {
    items,
    nextCursor: next
  };
}
