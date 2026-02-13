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
    configContent: string;
}

export class RemoteDeployer {
    /**
     * Deploys the WireGuard configuration to a remote host using native ssh/scp.
     */
    async deploy(options: RemoteDeployOptions): Promise<{ success: boolean; log: string }> {
        const { host, port, user, interfaceName, configContent } = options;
        let log = `[Deploy] Starting deployment to ${user}@${host}:${port}\n`;

        // 1. Create a temporary local file
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wg-deploy-"));
        const localPath = path.join(tempDir, `${interfaceName}.conf`);
        await fs.writeFile(localPath, configContent, { mode: 0o600 });

        const remoteTempPath = `/tmp/${interfaceName}.conf`;
        const finalConfPath = `/etc/wireguard/${interfaceName}.conf`;

        try {
            // 2. SCP the file to /tmp on remote
            log += `[SCP] Uploading config to ${remoteTempPath}...\n`;
            await execFileAsync("scp", [
                "-P", port.toString(),
                "-o", "StrictHostKeyChecking=accept-new",
                localPath,
                `${user}@${host}:${remoteTempPath}`
            ]);
            log += `[SCP] Success.\n`;

            // 3. Move file and fix permissions with SSH
            // We use sudo for move and up. 
            // User must have passwordless sudo or be root.
            log += `[SSH] Applying configuration and starting interface...\n`;
            const sshCmd = `sudo mv ${remoteTempPath} ${finalConfPath} && sudo chmod 600 ${finalConfPath} && sudo wg-quick up ${interfaceName} || sudo wg-quick save ${interfaceName}`;

            const { stdout, stderr } = await execFileAsync("ssh", [
                "-p", port.toString(),
                "-o", "StrictHostKeyChecking=accept-new",
                `${user}@${host}`,
                sshCmd
            ]);

            if (stdout) log += `[SSH STDOUT] ${stdout}\n`;
            if (stderr) log += `[SSH STDERR] ${stderr}\n`;

            log += `[Deploy] Finished successfully.\n`;
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
