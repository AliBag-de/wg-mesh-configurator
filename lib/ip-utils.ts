export type ParsedCidr = {
    base: number;
    prefix: number;
    size: number;
    last: number;
};

const MAX_IPV4 = 0xffffffff;

export function ipToInt(ip: string): number {
    const parts = ip.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
        throw new Error("IPv4 adresi gecersiz.");
    }
    return (
        (parts[0] << 24) +
        (parts[1] << 16) +
        (parts[2] << 8) +
        parts[3]
    ) >>> 0;
}

export function intToIp(num: number): string {
    return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255
    ].join(".");
}

export function parseCidr(cidr: string): ParsedCidr {
    const [ip, prefixStr] = cidr.split("/");
    const prefix = Number(prefixStr);
    if (!ip || Number.isNaN(prefix) || prefix < 8 || prefix > 30) {
        throw new Error("CIDR gecersiz. Ornek: 10.20.0.0/24");
    }
    const base = ipToInt(ip);
    const size = 2 ** (32 - prefix);
    const last = base + size - 1;
    if (last > MAX_IPV4) {
        throw new Error("CIDR araligi gecersiz.");
    }
    return { base, prefix, size, last };
}

/**
 * Calculates the IP address for a client based on the network CIDR and client index.
 * Clients start at base + 101.
 */
export function calculateClientIp(networkCidr: string, index: number): string {
    const parsed = parseCidr(networkCidr);
    const clientStart = parsed.base + 101;
    const clientIpInt = clientStart + index;

    if (clientIpInt > parsed.last) {
        throw new Error("Client IP falls outside of the network CIDR range.");
    }

    return intToIp(clientIpInt);
}
