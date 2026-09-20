export const TOOL_ID = "a11y-statement";
export const TOOL_PATH = "/tools/accessibility-statement";
export const ACCENT = "#8a9bb0";

type Env = Record<string, string | undefined>;

function publicEnv(): Env {
  return {
    NEXT_PUBLIC_SHOP_ORIGIN: process.env.NEXT_PUBLIC_SHOP_ORIGIN,
    NEXT_PUBLIC_STANDARD: process.env.NEXT_PUBLIC_STANDARD,
    NEXT_PUBLIC_STANDARD_CHECKED: process.env.NEXT_PUBLIC_STANDARD_CHECKED,
    NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK: process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK,
    NEXT_PUBLIC_NEXT_TOOL_CHECK: process.env.NEXT_PUBLIC_NEXT_TOOL_CHECK,
    NEXT_PUBLIC_NEXT_TOOL_FIX: process.env.NEXT_PUBLIC_NEXT_TOOL_FIX,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  };
}

export function shopOrigin(env: Env = publicEnv()): string | null {
  const raw = env.NEXT_PUBLIC_SHOP_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function defaultStandard(env: Env = publicEnv()): string {
  return env.NEXT_PUBLIC_STANDARD?.trim() || "WCAG 2.2 Level AA";
}

export function standardChecked(env: Env = publicEnv()): string {
  return env.NEXT_PUBLIC_STANDARD_CHECKED?.trim() || "2026-09-19";
}

export function allowLocalUnlock(env: Env = publicEnv()): boolean {
  return env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true";
}

export function nextToolCheck(env: Env = publicEnv()): string {
  return (
    env.NEXT_PUBLIC_NEXT_TOOL_CHECK?.trim() ||
    "https://www.goldengoosetools.com/tools/accessibility-check"
  );
}

export function nextToolFix(env: Env = publicEnv()): string | null {
  const raw = env.NEXT_PUBLIC_NEXT_TOOL_FIX?.trim();
  return raw || null;
}

export function publicBasePath(env: Env = publicEnv()): string {
  return env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
}
