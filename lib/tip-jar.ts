// The local tip ledger: tip records, validation, totals and the localStorage-backed store the page reads with
// useSyncExternalStore. No payment provider is involved anywhere.

export type Tip = { id: string; amount: number; note: string; at: number };

export const DENOMINATIONS = [50, 100, 200, 500];
export const STORAGE_KEY = "tip-jar-v2";
export const NO_RAIL_STATUS = "No payment rail connected. This is a local ledger.";

const EMPTY: Tip[] = [];

export function money(value: number): string {
  return `฿${value.toLocaleString("en-US")}`;
}

export function totalOf(tips: Tip[]): number {
  return tips.reduce((sum, tip) => sum + tip.amount, 0);
}

/** A new tip, or an error message when the amount is not a positive number. */
export function createTip(amount: number, note: string, at: number, id: string): { tip: Tip } | { error: string } {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than zero to print a receipt." };
  return { tip: { id, amount, note: note.trim() || "No note", at } };
}

function isTip(value: unknown): value is Tip {
  if (typeof value !== "object" || value === null) return false;
  const tip = value as Record<string, unknown>;
  return (
    typeof tip.id === "string" &&
    typeof tip.amount === "number" && Number.isFinite(tip.amount) && tip.amount > 0 &&
    typeof tip.note === "string" &&
    typeof tip.at === "number" && Number.isFinite(tip.at)
  );
}

/** Tips stored under STORAGE_KEY; broken JSON, non-lists and malformed entries are dropped. */
export function parseTips(raw: string | null): Tip[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTip) : EMPTY;
  } catch {
    return EMPTY;
  }
}

type Listener = () => void;

/** A tiny external store over one localStorage key. Falls back to memory when storage is unavailable. */
export function createTipStore(getStorage: () => Storage | null, key = STORAGE_KEY) {
  const listeners = new Set<Listener>();
  let memoryRaw: string | null = null;
  let useMemory = false;
  let cachedRaw: string | null | undefined;
  let cached: Tip[] = EMPTY;

  const readRaw = (): string | null => {
    if (useMemory) return memoryRaw;
    try {
      return getStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };

  const getSnapshot = (): Tip[] => {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = parseTips(raw);
    }
    return cached;
  };

  const notify = () => listeners.forEach((listener) => listener());

  return {
    getSnapshot,
    getServerSnapshot: (): Tip[] => EMPTY,
    subscribe(listener: Listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) listener();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    set(next: Tip[] | ((current: Tip[]) => Tip[])) {
      const value = typeof next === "function" ? next(getSnapshot()) : next;
      const raw = JSON.stringify(value);
      try {
        const storage = getStorage();
        if (!storage) throw new Error("no storage");
        storage.setItem(key, raw);
      } catch {
        useMemory = true;
        memoryRaw = raw;
      }
      notify();
    },
  };
}

export const tipStore = createTipStore(() => (typeof window === "undefined" ? null : window.localStorage));
