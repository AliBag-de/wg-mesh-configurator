import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import { isSudoPasswordError, getSudoInstruction } from "./response";

const execFileAsync = promisify(execFile);

export interface RemoteDeployOptions {
    host: string;
    port: number;
    user: string;
    interfaceName: string;
    files: { name: string; content: string }[];
    privateKeyContent?: string;
    peerIpsToPing?: string[];
    onLog?: (msg: string) => void;
    skipExecute?: boolean;
}

export class RemoteDeployer {
    /**
     * Deploys the WireGuard configuration and assets to a remote host.
     */
    async deploy(options: RemoteDeployOptions): Promise<{ success: boolean; log: string }> {
        const { host, port, user, interfaceName, files, onLog, skipExecute, privateKeyContent } = options;
        let log = "";
        let tempKeyFile: string | null = null;

        const appendLog = (msg: string) => {
            log += msg;
            if (onLog) onLog(msg);
        };

        appendLog(`[Deploy] Starting deployment to ${user}@${host}:${port}\n`);

        try {
            // 1. Handle ephemeral private key if provided
            const sshArgs = ["-p", port.toString(), "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes"];
            const scpArgs = ["-P", port.toString(), "-r", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes"];

            if (privateKeyContent) {
                tempKeyFile = path.join(os.tmpdir(), `wg_key_${randomUUID()}`);
                await fs.writeFile(tempKeyFile, privateKeyContent, { mode: 0o600 });
                sshArgs.push("-i", tempKeyFile);
                scpArgs.push("-i", tempKeyFile);
                appendLog(`[SSH] Using ephemeral private key at ${tempKeyFile}\n`);
            }

            // 2. Create a temporary local directory and write all files
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wg-deploy-"));
            try {
                for (const file of files) {
                    const filePath = path.join(tempDir, file.name);
                    await fs.writeFile(filePath, file.content, { mode: 0o600 });
                }

                const timestamp = Date.now();
                const remoteTempDir = `/tmp/wg_deploy_${interfaceName}_${timestamp}`;
                const isIpv6 = host.includes(":");
                const formattedHost = isIpv6 ? `[${host}]` : host;

                // 3. Prepare remote temp dir
                appendLog(`[SSH] Preparing remote directory ${remoteTempDir}...\n`);
                await execFileAsync("ssh", [...sshArgs, `${user}@${formattedHost}`, `mkdir -p ${remoteTempDir}`], { timeout: 15000 });

                // 4. SCP the entire directory to remote
                appendLog(`[SCP] Uploading files to ${remoteTempDir}...\n`);
                await execFileAsync("scp", [...scpArgs, `${tempDir}/.`, `${user}@${formattedHost}:${remoteTempDir}`], { timeout: 30000 });
                appendLog(`[SCP] Success.\n`);

                if (skipExecute) {
                    appendLog(`[Deploy] Upload complete. Automatic execution skipped as requested.\n`);
                    return { success: true, log };
                }

                // 5. Execute installation script
                return await this.executeExistingSetup({
                    host, port, user, interfaceName, peerIpsToPing: options.peerIpsToPing, onLog, privateKeyContent
                });
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
            }

        } catch (error: any) {
            const errorText = error.stderr || error.message || "";
            let errorMsg = `[ERROR] Deployment failed: ${error.message}\n`;

            if (isSudoPasswordError(errorText)) {
                errorMsg += `\n${getSudoInstruction(user)}\n`;
            } else if (error.stderr) {
                errorMsg += `[ERROR STDERR] ${error.stderr}\n`;
            }

            appendLog(errorMsg);
            return { success: false, log };
        } finally {
            if (tempKeyFile) {
                await fs.unlink(tempKeyFile).catch(() => { });
            }
        }
    }

    /**
     * Executes a raw command on the remote host via SSH.
     */
    async executeRawCommand(options: { host: string; port: number; user: string; privateKeyContent?: string; command: string; onLog?: (msg: string) => void }): Promise<{ success: boolean; log: string }> {
        const { host, port, user, privateKeyContent, command, onLog } = options;
        let log = "";
        let tempKeyFile: string | null = null;

        const appendLog = (msg: string) => {
            log += msg;
            if (onLog) onLog(msg);
        };

        const isIpv6 = host.includes(":");
        const formattedHost = isIpv6 ? `[${host}]` : host;

        try {
            const sshArgs = ["-p", port.toString(), "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes"];
            if (privateKeyContent) {
                tempKeyFile = path.join(os.tmpdir(), `wg_key_raw_${randomUUID()}`);
                await fs.writeFile(tempKeyFile, privateKeyContent, { mode: 0o600 });
                sshArgs.push("-i", tempKeyFile);
            }

            const { stdout, stderr } = await execFileAsync("ssh", [...sshArgs, `${user}@${formattedHost}`, command], { timeout: 30000 });

            if (stdout) appendLog(stdout + "\n");
            if (stderr) appendLog(`[STDERR]: ${stderr}\n`);

            return { success: true, log };
        } catch (err: any) {
            const errorText = err.stderr || err.message || "";
            let errorMsg = `[ERROR] Execution failed: ${err.message}\n`;

            if (isSudoPasswordError(errorText)) {
                errorMsg += `\n${getSudoInstruction(user)}\n`;
            } else if (err.stderr) {
                errorMsg += `[STDERR]: ${err.stderr}\n`;
            }

            appendLog(errorMsg);
            return { success: false, log };
        } finally {
            if (tempKeyFile) {
                await fs.unlink(tempKeyFile).catch(() => { });
            }
        }
    }

    /**
     * Executes an existing setup script on the remote host.
     */
    async executeExistingSetup(options: Omit<RemoteDeployOptions, 'files' | 'skipExecute'>): Promise<{ success: boolean; log: string }> {
        const { host, port, user, interfaceName, onLog, privateKeyContent } = options;
        let log = "";
        let tempKeyFile: string | null = null;

        const appendLog = (msg: string) => {
            log += msg;
            if (onLog) onLog(msg);
        };

        const isIpv6 = host.includes(":");
        const formattedHost = isIpv6 ? `[${host}]` : host;

        try {
            const sshArgs = ["-p", port.toString(), "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes"];
            if (privateKeyContent) {
                tempKeyFile = path.join(os.tmpdir(), `wg_key_exec_${randomUUID()}`);
                await fs.writeFile(tempKeyFile, privateKeyContent, { mode: 0o600 });
                sshArgs.push("-i", tempKeyFile);
            }

            // 1. Resolve the most recent deployment directory for this interface
            appendLog(`[SSH] Troubleshooting remote directory for ${interfaceName}...\n`);
            const resolveCmd = `ls -td /tmp/wg_deploy_${interfaceName}_* 2>/dev/null | head -n 1`;
            const { stdout: resolvedPath } = await execFileAsync("ssh", [...sshArgs, `${user}@${formattedHost}`, resolveCmd], { timeout: 10000 });

            const remoteTempDir = resolvedPath.trim();
            if (!remoteTempDir) {
                throw new Error(`Could not find a deployment directory for ${interfaceName} on the remote host. Please run "Upload" first.`);
            }

            appendLog(`[SSH] Found deployment directory: ${remoteTempDir}\n`);
            appendLog(`[SSH] Executing setup script...\n`);
            const manualCmd = `cd ${remoteTempDir} && sudo bash ./setup.sh`;

            const { stdout: setupOut, stderr: setupErr } = await execFileAsync("ssh", [...sshArgs, `${user}@${formattedHost}`, manualCmd], { timeout: 60000 });
            appendLog(setupOut + "\n");
            if (setupErr) appendLog(`[Setup Warning/Error]: ${setupErr}\n`);

            // Verify wg show
            appendLog(`[TEST] Verifying WireGuard interface status...\n`);
            try {
                const { stdout: wgOut } = await execFileAsync("ssh", [...sshArgs, `${user}@${formattedHost}`, `sudo wg show ${interfaceName}`], { timeout: 10000 });
                appendLog(`=== wg show ===\n${wgOut}\n===============\n`);
            } catch (e: any) {
                appendLog(`[Warning] Could not get wg show output: ${e.message}\n`);
            }

            // Ping tests
            if (options.peerIpsToPing && options.peerIpsToPing.length > 0) {
                const pingTarget = options.peerIpsToPing[0];
                appendLog(`[TEST] Pinging peer ${pingTarget} to verify connectivity...\n`);
                try {
                    const { stdout: pingOut } = await execFileAsync("ssh", [...sshArgs, `${user}@${formattedHost}`, `ping -c 3 -W 2 ${pingTarget}`], { timeout: 15000 });
                    appendLog(`=== ping result ===\n${pingOut}\n===================\n`);
                    appendLog(`[SUCCESS] Network connectivity verified!\n`);
                } catch (e: any) {
                    appendLog(`[Warning] Ping test failed. Peer might be offline or routing is taking time.\n${e.message}\n`);
                }
            }

            appendLog(`\n[SSH] Remote operations finished successfully.\n`);
            return { success: true, log };

        } catch (err: any) {
            const errorText = err.stderr || err.message || "";
            let errorMsg = `[ERROR] Execution failed: ${err.message}\n`;

            if (isSudoPasswordError(errorText)) {
                errorMsg += `\n${getSudoInstruction(user)}\n`;
            } else if (err.stderr) {
                errorMsg += `[STDERR]: ${err.stderr}\n`;
            }

            appendLog(errorMsg);
            return { success: false, log };
        } finally {
            if (tempKeyFile) {
                await fs.unlink(tempKeyFile).catch(() => { });
            }
        }
    }
}

export const remoteDeployer = new RemoteDeployer();
