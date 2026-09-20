export const TOOL_ID = "a11y-statement";
export const TOOL_PATH = "/tools/accessibility-statement";
export const ACCENT = "#8a9bb0";

type Env = Record<string, string | undefined>;

export function shopOrigin(env: Env = process.env): string | null {
  const raw = env.NEXT_PUBLIC_SHOP_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function defaultStandard(env: Env = process.env): string {
  return env.NEXT_PUBLIC_STANDARD?.trim() || "WCAG 2.2 Level AA";
}

export function standardChecked(env: Env = process.env): string {
  return env.NEXT_PUBLIC_STANDARD_CHECKED?.trim() || "2026-09-19";
}

export function allowLocalUnlock(env: Env = process.env): boolean {
  return env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true";
}

export function nextToolCheck(env: Env = process.env): string {
  return (
    env.NEXT_PUBLIC_NEXT_TOOL_CHECK?.trim() ||
    "https://www.goldengoosetools.com/tools/accessibility-check"
  );
}

export function nextToolFix(env: Env = process.env): string | null {
  const raw = env.NEXT_PUBLIC_NEXT_TOOL_FIX?.trim();
  return raw || null;
}

export function publicBasePath(env: Env = process.env): string {
  return env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
}
