import { sha256 } from "@noble/hashes/sha256";

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof window !== "undefined") {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

export function deriveDeterministicPsk(a: string, b: string): string {
  const [left, right] = [a.trim(), b.trim()].sort();
  const seed = `wg-mesh-psk::${left}::${right}`;
  return bytesToBase64(sha256(seed));
}

