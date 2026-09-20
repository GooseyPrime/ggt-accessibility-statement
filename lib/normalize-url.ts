const SCHEME = /^(https?:\/\/)/i;
const WRAPS = /^[\s<"'\[]+|[\s>"'\]]+$/g;
const DOMAIN = /(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])+){1,}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?/i;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export type NormalizedUrl = {
  href: string | null;
  host: string | null;
  note?: string;
  error?: string;
};

export function extractUrlCandidate(raw: string): string {
  const stripped = raw.replace(WRAPS, "").replace(/\u00a0/g, " ").trim();
  if (!stripped) return "";

  const match = stripped.match(DOMAIN);
  if (match?.[0]) return match[0];

  const firstToken = stripped.split(/\s+/)[0] ?? "";
  return firstToken.replace(/[.,;:!?)]+$/g, "");
}

export function normalizeUrl(raw: string): NormalizedUrl {
  const candidate = extractUrlCandidate(raw);
  if (!candidate) {
    return { href: null, host: null, error: "Enter a website address." };
  }

  let working = candidate.replace(/[.,;:!?)]+$/g, "");
  if (!SCHEME.test(working)) {
    working = `https://${working}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(working);
  } catch {
    return {
      href: null,
      host: null,
      error: "That does not look like a website address. Try yourbusiness.com.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { href: null, host: null, error: "Use an http or https website address." };
  }

  if (!parsed.hostname.includes(".")) {
    return {
      href: null,
      host: null,
      error: "That does not look like a website address. Try yourbusiness.com.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (isBlockedHost(host)) {
    return { href: null, host: null, error: "That address cannot be checked from this tool." };
  }

  parsed.hash = "";
  const href = parsed.toString();
  const note =
    candidate !== raw.trim()
      ? "Extra words after the address were ignored."
      : undefined;

  return { href, host, note };
}

export function isBlockedHost(host: string): boolean {
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (isPrivateIpv4(host)) return true;
  if (isPrivateIpv6(host)) return true;
  return false;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.includes(":")) return false;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = mappedIpv4FromIpv6(normalized.slice("::ffff:".length));
    return mapped ? isPrivateIpv4(mapped) : false;
  }
  return /^f[c-d][0-9a-f]{0,2}:/i.test(normalized) || /^fe[89ab][0-9a-f]{0,2}:/i.test(normalized);
}

function mappedIpv4FromIpv6(value: string): string | null {
  if (value.includes(".")) {
    return value;
  }
  const parts = value.split(":");
  if (parts.length !== 2 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) {
    return null;
  }
  const [left, right] = parts.map((part) => Number.parseInt(part, 16));
  return [left >> 8, left & 255, right >> 8, right & 255].join(".");
}

export function resolveHref(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
