import fs from "fs";
import { resolveMeshState, generateNodeConfig } from "./lib/generate";

const fileContent = fs.readFileSync("C:\\Users\\aliba\\Downloads\\wg-mesh-config-2026-03-02 (1).json", "utf-8");
const config = JSON.parse(fileContent);

// Add missing fields for payload
const payload = {
    ...config,
    topology: "full_mesh" // Assume full_mesh since it's the default
};

const state = resolveMeshState(payload);

console.log("=== Node Keys ===");
state.resolvedNodes.forEach(n => {
    console.log(`${n.name}: PubKey = ${n.publicKey}, PrivKey = ${n.privateKey}`);
});

console.log("\n=== Generated Config for Hetzner-Wg ===");
const pskGetter = () => "x/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=";
console.log(generateNodeConfig("Hetzner-Wg", state.resolvedNodes, state.resolvedClients, state.nodeIps, payload, pskGetter));
