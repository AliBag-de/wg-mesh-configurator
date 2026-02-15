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
}

export class RemoteDeployer {
    /**
     * Deploys the WireGuard configuration and assets to a remote host.
     */
    async deploy(options: RemoteDeployOptions): Promise<{ success: boolean; log: string }> {
        const { host, port, user, interfaceName, files } = options;
        let log = `[Deploy] Starting deployment to ${user}@${host}:${port}\n`;

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
            log += `[SSH] Preparing remote directory ${remoteTempDir}...\n`;
            await execFileAsync("ssh", [
                "-p", port.toString(),
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                `${user}@${formattedHost}`,
                `mkdir -p ${remoteTempDir}`
            ], { timeout: 15000 });

            // 3. SCP the entire directory to remote
            log += `[SCP] Uploading files to ${remoteTempDir}...\n`;
            await execFileAsync("scp", [
                "-P", port.toString(),
                "-r",
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                `${tempDir}/.`, // Upload contents of tempDir
                `${user}@${formattedHost}:${remoteTempDir}`
            ], { timeout: 30000 });
            log += `[SCP] Success.\n`;

            // 4. Provide manual installation instruction
            const manualCmd = `cd ${remoteTempDir} && sudo bash ./setup.sh`;

            log += `\n[ACTION REQUIRED] Files uploaded to ${remoteTempDir}. Connection to ${formattedHost} is active.\n`;
            log += `Run the following command on the remote server to complete installation:\n\n`;
            log += `------------------------------------------------------------\n`;
            log += `${manualCmd}\n`;
            log += `------------------------------------------------------------\n\n`;
            log += `[Deploy] Preparation finished successfully.\n`;

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
