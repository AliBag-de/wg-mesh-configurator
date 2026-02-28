import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

export interface RemoteDeployOptions {
    host: string;
    port: number;
    user: string;
    interfaceName: string;
    files: { name: string; content: string }[];
    peerIpsToPing?: string[];
    onLog?: (msg: string) => void;
}

export class RemoteDeployer {
    /**
     * Deploys the WireGuard configuration and assets to a remote host.
     */
    async deploy(options: RemoteDeployOptions): Promise<{ success: boolean; log: string }> {
        const { host, port, user, interfaceName, files, onLog } = options;
        let log = "";

        const appendLog = (msg: string) => {
            log += msg;
            if (onLog) onLog(msg);
        };

        appendLog(`[Deploy] Starting deployment to ${user}@${host}:${port}\n`);

        // 1. Create a temporary local directory and write all files
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wg-deploy-"));

        for (const file of files) {
            const filePath = path.join(tempDir, file.name);
            await fs.writeFile(filePath, file.content, { mode: 0o600 });
        }

        const remoteTempDir = `/tmp/wg_deploy_${interfaceName}`;

        const isIpv6 = host.includes(":");
        const formattedHost = isIpv6 ? `[${host}]` : host;

        try {
            // 2. Prepare remote temp dir
            appendLog(`[SSH] Preparing remote directory ${remoteTempDir}...\n`);
            await execFileAsync("ssh", [
                "-p", port.toString(),
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                `${user}@${formattedHost}`,
                `mkdir -p ${remoteTempDir}`
            ], { timeout: 15000 });

            // 3. SCP the entire directory to remote
            appendLog(`[SCP] Uploading files to ${remoteTempDir}...\n`);
            await execFileAsync("scp", [
                "-P", port.toString(),
                "-r",
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                `${tempDir}/.`, // Upload contents of tempDir
                `${user}@${formattedHost}:${remoteTempDir}`
            ], { timeout: 30000 });
            appendLog(`[SCP] Success.\n`);

            // 4. Execute installation script
            appendLog(`[SSH] Executing setup script...\n`);
            const manualCmd = `cd ${remoteTempDir} && sudo bash ./setup.sh`;

            try {
                const { stdout: setupOut, stderr: setupErr } = await execFileAsync("ssh", [
                    "-p", port.toString(),
                    "-o", "StrictHostKeyChecking=accept-new",
                    "-o", "ConnectTimeout=10",
                    "-o", "BatchMode=yes",
                    // "-t", // pseudo-tty might cause issues with BatchMode
                    `${user}@${formattedHost}`,
                    manualCmd
                ], { timeout: 60000 });
                appendLog(setupOut + "\n");
                if (setupErr) appendLog(`[Setup Warning/Error]: ${setupErr}\n`);
            } catch (err: any) {
                appendLog(`[ERROR] Setup script execution failed: ${err.message}\n`);
                if (err.stderr) appendLog(`[STDERR]: ${err.stderr}\n`);
                return { success: false, log };
            }

            // 5. Verify wg show
            appendLog(`[TEST] Verifying WireGuard interface status...\n`);
            try {
                const { stdout: wgOut } = await execFileAsync("ssh", [
                    "-p", port.toString(),
                    "-o", "StrictHostKeyChecking=accept-new",
                    "-o", "ConnectTimeout=10",
                    "-o", "BatchMode=yes",
                    `${user}@${formattedHost}`,
                    `sudo wg show ${interfaceName}`
                ], { timeout: 10000 });
                appendLog(`=== wg show ===\n${wgOut}\n===============\n`);
            } catch (e: any) {
                appendLog(`[Warning] Could not get wg show output: ${e.message}\n`);
            }

            // 6. Ping tests
            if (options.peerIpsToPing && options.peerIpsToPing.length > 0) {
                // Just ping the first available peer to verify routing works
                const pingTarget = options.peerIpsToPing[0];
                appendLog(`[TEST] Pinging peer ${pingTarget} to verify connectivity...\n`);
                try {
                    const { stdout: pingOut } = await execFileAsync("ssh", [
                        "-p", port.toString(),
                        "-o", "StrictHostKeyChecking=accept-new",
                        "-o", "ConnectTimeout=10",
                        "-o", "BatchMode=yes",
                        `${user}@${formattedHost}`,
                        `ping -c 3 -W 2 ${pingTarget}`
                    ], { timeout: 15000 });
                    appendLog(`=== ping result ===\n${pingOut}\n===================\n`);
                    appendLog(`[SUCCESS] Network connectivity verified!\n`);
                } catch (e: any) {
                    appendLog(`[Warning] Ping test failed. The peer might be offline or routing is taking time.\n${e.message}\n`);
                    if (e.stderr) appendLog(`[STDERR]: ${e.stderr}\n`);
                }
            }

            appendLog(`\n[Deploy] Installation and verification finished successfully.\n`);

            return { success: true, log };

        } catch (error: any) {
            log += `[ERROR] Deployment failed: ${error.message}\n`;
            if (error.stderr) log += `[ERROR STDERR] ${error.stderr}\n`;
            return { success: false, log };
        } finally {
            // Cleanup local temp file
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        }
    }
}

export const remoteDeployer = new RemoteDeployer();
