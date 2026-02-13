import { x25519 } from "@noble/curves/ed25519";

function encodeBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes).toString("base64");
    }
    return btoa(String.fromCharCode(...bytes));
}

function decodeBase64(value: string): Uint8Array {
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(value, "base64"));
    }
    return new Uint8Array(atob(value).split("").map(c => c.charCodeAt(0)));
}

export function generateKeypair() {
    const privateKeyBytes = new Uint8Array(32);
    if (typeof window !== "undefined" && window.crypto) {
        window.crypto.getRandomValues(privateKeyBytes);
    } else {
        // Falls back to Node.js crypto if available
        const crypto = require("crypto");
        const bytes = crypto.randomBytes(32);
        privateKeyBytes.set(bytes);
    }

    const publicKeyBytes = x25519.getPublicKey(privateKeyBytes);
    return {
        privateKey: encodeBase64(privateKeyBytes),
        publicKey: encodeBase64(publicKeyBytes)
    };
}

export function derivePublicKey(privateKey: string): string {
    const bytes = decodeBase64(privateKey);
    if (bytes.length !== 32) {
        throw new Error("Invalid private key length");
    }
    return encodeBase64(x25519.getPublicKey(bytes));
}
