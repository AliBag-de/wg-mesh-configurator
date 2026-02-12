import { promises as fs } from "fs";
import path from "path";
import { Peer, peerSchema } from "./contracts";
import { z } from "zod";

// Schema for the persisted state file
const metaSchema = z.object({
    version: z.number().int().min(1),
    updatedAt: z.string(),
    interfaces: z.record(
        z.string(), // interface name
        z.object({
            listenPort: z.number().int(),
            addressCidr: z.string(),
            revision: z.number().int(),
            isUp: z.boolean(),
            privateKey: z.string().optional(),
        })
    ),
    peers: z.array(peerSchema),
});

export type PersistedState = z.infer<typeof metaSchema>;

const DEFAULT_STATE_FILE = process.env.WG_STATE_FILE || "/etc/wireguard/wg-mesh-state.json";
const DEFAULT_LOCK_FILE = process.env.WG_LOCK_FILE;
const STALE_LOCK_TIMEOUT_MS = 5000; // 5 seconds timeout for stale locks

// Helper to check if a process is running
function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

export class StateManager {
    private filePath: string;
    private lockFile: string;

    constructor(filePath: string = DEFAULT_STATE_FILE, lockFile?: string) {
        this.filePath = filePath;
        this.lockFile = lockFile || DEFAULT_LOCK_FILE || `${filePath}.lock`;
    }

    private async acquireLock(retries = 20, delay = 100): Promise<void> {
        const myPid = process.pid;
        await fs.mkdir(path.dirname(this.lockFile), { recursive: true });

        for (let i = 0; i < retries; i++) {
            try {
                // Try to create lockfile exclusively
                await fs.writeFile(this.lockFile, `${myPid}:${Date.now()}`, { flag: "wx" });
                return;
            } catch (e: any) {
                if (e.code === "EEXIST") {
                    // Check for stale lock
                    try {
                        const content = await fs.readFile(this.lockFile, "utf-8");
                        const [pidStr, tsStr] = content.split(":");
                        const pid = parseInt(pidStr, 10);
                        const ts = parseInt(tsStr, 10);

                        const now = Date.now();

                        // If lock is old AND process is dead, force unlock
                        if (now - ts > STALE_LOCK_TIMEOUT_MS && !isProcessRunning(pid)) {
                            await fs.unlink(this.lockFile);
                            continue; // Retry immediately
                        }
                    } catch {
                        // Ignore read errors, maybe lock was deleted
                    }

                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                throw e;
            }
        }
        throw new Error(`Could not acquire lock on state file: ${this.filePath}`);
    }

    private async releaseLock() {
        try {
            await fs.unlink(this.lockFile);
        } catch {
            // Ignore if lock file is already gone
        }
    }

    // Transactional update: lock -> load -> mutate -> save -> unlock
    async update<T>(callback: (state: PersistedState) => Promise<T> | T): Promise<T> {
        await this.acquireLock();
        try {
            const state = await this._loadWithoutLock();
            const result = await callback(state);
            await this._saveWithoutLock(state);
            return result;
        } finally {
            await this.releaseLock();
        }
    }

    // Read-only access: lock -> load -> unlock (NO SAVE)
    async load(): Promise<PersistedState> {
        await this.acquireLock();
        try {
            return await this._loadWithoutLock();
        } finally {
            await this.releaseLock();
        }
    }

    // Internal load (assumes lock is held)
    private async _loadWithoutLock(): Promise<PersistedState> {
        try {
            const content = await fs.readFile(this.filePath, "utf-8");
            const json = JSON.parse(content);
            const result = metaSchema.safeParse(json);

            if (!result.success) {
                throw new Error(`State file corruption: ${result.error.message}`);
            }
            return result.data;
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return {
                    version: 1,
                    updatedAt: new Date().toISOString(),
                    interfaces: {},
                    peers: [],
                };
            }
            throw error;
        }
    }

    // Internal save (assumes lock is held)
    private async _saveWithoutLock(state: PersistedState): Promise<void> {
        const tempFile = `${this.filePath}.tmp.${Date.now()}`;
        const content = JSON.stringify(state, null, 2);

        try {
            // 1. Write to temp file
            // 'w' flag truncates if exists, but temp name is unique
            const handle = await fs.open(tempFile, 'w');
            await handle.writeFile(content, "utf-8");

            // 2. fsync file content
            await handle.sync();
            await handle.close();

            // 3. Rename (Atomic)
            await fs.rename(tempFile, this.filePath);

            // 4. fsync directory (to ensure rename persists)
            try {
                const dirHandle = await fs.open(path.dirname(this.filePath), 'r');
                await dirHandle.sync();
                await dirHandle.close();
            } catch (e) {
                // Ignore directory sync errors (e.g. permissions)
            }

        } catch (error) {
            // Clean up temp file on error
            try {
                await fs.unlink(tempFile);
            } catch { }
            throw error;
        }
    }
}
