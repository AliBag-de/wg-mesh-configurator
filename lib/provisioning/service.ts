import { randomUUID } from "crypto";
import {
  ApplyPeersRequest,
  AuditQuery,
  DeployConfig,
  Peer,
  ReconcileRequest,
  ToggleInterfaceRequest,
  RuntimeInterface,
  RuntimePeer,
  SystemInfo
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

type InterfacePeer = Peer & {
  runtime: {
    latestHandshake: number;
    transferRx: number;
    transferTx: number;
  };
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
  return state.peers.filter((p: Peer) => p.interface === interfaceName || (!p.interface && interfaceName === "wg0"));
}

export async function listInterfaces() {
  const state = await stateManager.load();
  const discoveredNames = await wgAdapter.listInterfaces();

  const peerInterfaceNames = new Set(
    state.peers.map((p: Peer) => p.interface || "wg0")
  );

  const allNames = new Set<string>([
    ...Object.keys(state.interfaces),
    ...(discoveredNames as string[]),
    ...(Array.from(peerInterfaceNames) as string[])
  ]);

  return (Array.from(allNames) as string[]).map((name: string) => {
    const iface = state.interfaces[name];
    const peerCount = getPeersForInterface(state, name).length;

    // If interface exists in state, use its properties
    // Otherwise, it's a discovered host interface not yet managed by mesh state
    if (iface) {
      return {
        name,
        isUp: iface.isUp,
        listenPort: iface.listenPort,
        peerCount,
        lastSyncAt: state.updatedAt
      };
    }

    // Default values for discovered interfaces
    return {
      name,
      isUp: true, // If 'wg show' sees it, it's at least configured
      listenPort: 0,
      peerCount, // Use the actual calculated peer count
      lastSyncAt: state.updatedAt
    };
  });
}

export async function getInterfaceDetails(name: string) {
  const state = await stateManager.load();
  let iface = state.interfaces[name];

  const [runtimeData, systemInfo] = await Promise.all([
    wgAdapter.getInterface(name),
    wgAdapter.getSystemInfo()
  ]);

  if (!runtimeData.exists && !iface) {
    throw new Error("Interface not found");
  }

  // If it exists in runtime but not in state, create a synthetic state entry
  if (!iface) {
    iface = {
      listenPort: runtimeData.listenPort || 0,
      addressCidr: "unknown/24",
      revision: 0,
      isUp: true
    };
  }

  const { peers: runtimePeers } = runtimeData;
  const runtimeMap = new Map<string, RuntimePeer>(runtimePeers.map((p: RuntimePeer) => [p.publicKey, p]));

  // Get peers from state
  const statePeers = getPeersForInterface(state, name);
  const stateKeys = new Set(statePeers.map((p: Peer) => p.publicKey));

  const peers: InterfacePeer[] = statePeers.map((peer: Peer) => {
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

  // Add discovered peers that are NOT in state as unmanaged peers
  for (const runtime of runtimePeers) {
    if (!stateKeys.has(runtime.publicKey)) {
      peers.push({
        peerId: `discovered_${runtime.publicKey.slice(0, 12)}`,
        name: `discovered-${runtime.publicKey.slice(0, 8)}`,
        publicKey: runtime.publicKey,
        allowedIps: runtime.allowedIps,
        endpoint: runtime.endpoint,
        persistentKeepalive: runtime.persistentKeepalive,
        isActive: true,
        interface: name,
        isUnmanaged: true,
        runtime: {
          latestHandshake: runtime.latestHandshake,
          transferRx: runtime.transferRx,
          transferTx: runtime.transferTx
        }
      });
    }
  }

  // Mask private key if present
  const maskedPrivateKey = iface.privateKey
    ? iface.privateKey.substring(0, 4) + "..." + iface.privateKey.substring(iface.privateKey.length - 4)
    : undefined;

  return {
    interface: {
      name: name,
      isUp: iface.isUp,
      listenPort: runtimeData.listenPort || iface.listenPort,
      addressCidr: iface.addressCidr,
      revision: iface.revision,
      publicKey: runtimeData.publicKey,
      privateKey: maskedPrivateKey,
      fwmark: runtimeData.fwmark,
      mtu: runtimeData.mtu,
      dns: runtimeData.dns,
      table: runtimeData.table
    },
    system: systemInfo,
    peers
  };
}

class RevisionConflictError extends Error {
  code = "REVISION_CONFLICT";
  details: { expected: number; received: number };

  constructor(expected: number, received: number) {
    super("Revision mismatch");
    this.name = "RevisionConflictError";
    this.details = { expected, received };
  }
}

function assertRevision(currentRevision: number, expectedRevision: number) {
  if (currentRevision !== expectedRevision) {
    throw new RevisionConflictError(currentRevision, expectedRevision);
  }
}

export async function applyPeerOperations(
  name: string,
  input: ApplyPeersRequest
) {
  const initialState = await stateManager.load();
  let ifaceState = initialState.interfaces[name];
  if (!ifaceState) {
    const runtime = await wgAdapter.getInterface(name);
    if (!runtime.exists) throw new Error("Interface not found");
    // Synthetic state if it exists in runtime but not in state
    ifaceState = {
      listenPort: 0,
      addressCidr: "unknown/24",
      revision: 0,
      isUp: true
    };
  }
  assertRevision(ifaceState.revision, input.revision);

  const currentPeers = getPeersForInterface(initialState, name).map((peer: Peer) => ({ ...peer }));
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
    const plan = runtimeOps.map((op: RuntimeOp) => {
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
      let iface = state.interfaces[name];
      if (!iface) {
        const runtime = await wgAdapter.getInterface(name);
        if (!runtime.exists) throw new Error("Interface not found");
        iface = {
          listenPort: 0,
          addressCidr: "unknown/24",
          revision: 0,
          isUp: true
        };
        state.interfaces[name] = iface;
      }
      assertRevision(iface.revision, input.revision);

      const otherPeers = state.peers.filter((p: Peer) => p.interface !== name && (p.interface || name !== "wg0"));
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
  let iface = state.interfaces[name];
  if (!iface) {
    const runtime = await wgAdapter.getInterface(name);
    if (!runtime.exists) throw new Error("Interface not found");
    iface = {
      listenPort: 0,
      addressCidr: "unknown/24",
      revision: 0,
      isUp: true
    };
  }
  assertRevision(iface.revision, input.revision);

  if (input.dryRun) {
    return { name, isUp: iface.isUp, revision: iface.revision };
  }

  await wgAdapter.toggleInterface(name, input.isUp);
  try {
    const revision = await stateManager.update(async (lockedState) => {
      let lockedIface = lockedState.interfaces[name];
      if (!lockedIface) {
        const runtime = await wgAdapter.getInterface(name);
        if (!runtime.exists) throw new Error("Interface not found");
        lockedIface = {
          listenPort: 0,
          addressCidr: "unknown/24",
          revision: 0,
          isUp: true
        };
        lockedState.interfaces[name] = lockedIface;
      }
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
  const initialState = await stateManager.load();
  let iface = initialState.interfaces[name];
  if (!iface) {
    const runtime = await wgAdapter.getInterface(name);
    if (!runtime.exists) throw new Error("Interface not found");
    // Synthetic state if it exists in runtime but not in state
    iface = {
      listenPort: 0,
      addressCidr: "unknown/24",
      revision: 0,
      isUp: true
    };
  }
  assertRevision(iface.revision, input.revision);

  const interfacePeers = getPeersForInterface(initialState, name);
  const { peers: runtimePeers } = await wgAdapter.getInterface(name);
  const runtimeKeys = new Set(runtimePeers.map((p: RuntimePeer) => p.publicKey));
  const stateKeys = new Set(interfacePeers.map((p: Peer) => p.publicKey));

  const missingInRuntime = interfacePeers.filter((p: Peer) => p.isActive && !runtimeKeys.has(p.publicKey));
  const zombies = runtimePeers.filter((p: RuntimePeer) => !stateKeys.has(p.publicKey));
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
    let lockedIface = lockedState.interfaces[name];
    if (!lockedIface) {
      const runtime = await wgAdapter.getInterface(name);
      if (!runtime.exists) throw new Error("Interface not found");
      lockedIface = {
        listenPort: 0,
        addressCidr: "unknown/24",
        revision: 0,
        isUp: true
      };
      lockedState.interfaces[name] = lockedIface;
    }
    assertRevision(lockedIface.revision, input.revision);

    let changed = false;

    if (input.mode === "runtime_to_state") {
      const nextPeers = getPeersForInterface(lockedState, name).map((peer: Peer) => ({ ...peer }));
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

      const otherPeers = lockedState.peers.filter((p: Peer) => p.interface !== name && (p.interface || name !== "wg0"));
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

export async function deployMeshConfig(config: DeployConfig) {
  const { interface: iface, peers } = config;
  const name = iface.name;

  const newPeers: Peer[] = peers.map((p: any) => ({
    peerId: randomUUID(),
    name: p.name,
    publicKey: p.publicKey,
    allowedIps: p.allowedIps,
    endpoint: p.endpoint,
    presharedKey: p.presharedKey,
    persistentKeepalive: 25,
    isActive: true,
    interface: name
  }));

  await stateManager.update(async (state) => {
    // 1. Prepare Interface State
    state.interfaces[name] = {
      listenPort: iface.listenPort,
      addressCidr: iface.addressCidr,
      revision: (state.interfaces[name]?.revision || 0) + 1,
      isUp: true,
      privateKey: iface.privateKey
    };

    // 2. Clear existing peers for this interface and add new ones
    const otherPeers = state.peers.filter((p: Peer) => p.interface !== name && (p.interface || name !== "wg0"));

    state.peers = [...otherPeers, ...newPeers];
    state.updatedAt = new Date().toISOString();
  });

  // 3. Apply to Runtime
  // Ensure interface is up with new settings
  await wgAdapter.upInterface(name, {
    privateKey: iface.privateKey,
    listenPort: iface.listenPort,
    address: iface.addressCidr
  });

  // Purge runtime peers and add new ones (Reconciliation logic)
  const { peers: runtimePeers } = await wgAdapter.getInterface(name);
  for (const rp of runtimePeers) {
    await wgAdapter.removePeer(name, rp.publicKey, { ignoreIfMissing: true });
  }

  for (const p of newPeers) {
    await wgAdapter.addPeer(name, p);
  }

  pushAudit(name, { actor: "admin", action: "interface.deploy", meta: { node: name, peerCount: peers.length } });

  return { success: true };
}
