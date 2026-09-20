import type { BuyerAnswers } from "./types";

export const STORAGE_KEY = "ggt-a11y-statement-draft";

export type DraftState = {
  url: string;
  reportText: string;
  answers: BuyerAnswers;
  savedAt: string;
};

export function loadDraft(): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed || typeof parsed.url !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: DraftState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
