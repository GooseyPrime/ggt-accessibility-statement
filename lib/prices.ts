export type PriceSet = {
  aloneCents: number | null;
  withReportCents: number | null;
};

export function readPriceCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function shopPrices(env: Record<string, string | undefined> = process.env): PriceSet {
  return {
    aloneCents: readPriceCents(env.NEXT_PUBLIC_PRICE_CENTS),
    withReportCents: readPriceCents(env.NEXT_PUBLIC_PRICE_WITH_REPORT_CENTS),
  };
}

export function selectedPrice(
  prices: PriceSet,
  withReport: boolean,
): { cents: number; label: string } | null {
  const cents = withReport ? prices.withReportCents ?? prices.aloneCents : prices.aloneCents;
  if (cents == null) return null;
  return { cents, label: formatUsdFromCents(cents) };
}
