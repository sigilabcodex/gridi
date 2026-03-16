import type { Patch } from "../../patch.ts";
import { clamp, defaultPatch, migratePatch } from "../../patch.ts";

export const BANK_COUNT = 4;

const LS_STATE = "gridi.state.v0_30";

export type PersistedState = {
  bank: number;
  banks: Patch[];
};

export function safeParseJSON<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function isPatchLike(x: any): x is Patch {
  return x && typeof x === "object" && x.version === "0.3" && Array.isArray(x.modules);
}

export function ensureBankCount(banks: Patch[], count: number) {
  const out = banks.slice(0, count);
  while (out.length < count) out.push(defaultPatch());
  return out;
}

export function loadState(): PersistedState | null {
  const raw = localStorage.getItem(LS_STATE);
  if (!raw) return null;

  const parsed = safeParseJSON<any>(raw);
  if (!parsed) return null;

  const bank = typeof parsed.bank === "number" ? parsed.bank : 0;
  const banksRaw = Array.isArray(parsed.banks) ? parsed.banks : [];
  const banks = banksRaw.filter(isPatchLike);
  if (!banks.length) return null;

  return {
    bank: clamp(bank, 0, BANK_COUNT - 1),
    banks: ensureBankCount(banks, BANK_COUNT).map((p) => migratePatch(p)),
  };
}

export function saveState(bank: number, banks: Patch[]) {
  const payload: PersistedState = {
    bank: clamp(bank, 0, BANK_COUNT - 1),
    banks,
  };

  localStorage.setItem(LS_STATE, JSON.stringify(payload));
}
