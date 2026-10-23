import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, createTip, createTipStore, money, parseTips, totalOf, type Tip } from "@/lib/tip-jar";

const tip = (id: string, amount: number): Tip => ({ id, amount, note: "n", at: 0 });

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  } as unknown as Storage & { data: Map<string, string> };
}

describe("createTip", () => {
  it("rejects zero, negative and non-numeric amounts", () => {
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(createTip(amount, "hi", 1, "a")).toEqual({ error: "Enter an amount greater than zero to print a receipt." });
    }
  });

  it("trims the note and falls back to 'No note'", () => {
    expect(createTip(100, "  thanks  ", 5, "a")).toEqual({ tip: { id: "a", amount: 100, note: "thanks", at: 5 } });
    expect(createTip(50, "   ", 5, "b")).toEqual({ tip: { id: "b", amount: 50, note: "No note", at: 5 } });
  });
});

describe("totals and money", () => {
  it("sums amounts and formats baht with thousands separators", () => {
    expect(totalOf([])).toBe(0);
    expect(totalOf([tip("a", 100), tip("b", 1500)])).toBe(1600);
    expect(money(1600)).toBe("฿1,600");
  });
});

describe("parseTips", () => {
  it("reads a saved ledger", () => {
    expect(parseTips(JSON.stringify([tip("a", 100)]))).toEqual([tip("a", 100)]);
  });

  it("treats missing or broken JSON as an empty ledger", () => {
    expect(parseTips(null)).toEqual([]);
    expect(parseTips("{not json")).toEqual([]);
  });

  it("ignores stored values that are not a list of tips, so the total never breaks", () => {
    expect(parseTips('{"amount":100}')).toEqual([]);
    expect(parseTips("null")).toEqual([]);
    expect(() => totalOf(parseTips('"text"'))).not.toThrow();
    const mixed = parseTips(JSON.stringify([tip("a", 100), { id: "b", amount: "500", note: "x", at: 0 }, null, { id: "c" }]));
    expect(mixed).toEqual([tip("a", 100)]);
    expect(totalOf(mixed)).toBe(100);
  });
});

describe("createTipStore", () => {
  it("reads the saved ledger and returns the same array until storage changes", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify([tip("a", 100)]) });
    const store = createTipStore(() => storage);
    const first = store.getSnapshot();
    expect(first).toEqual([tip("a", 100)]);
    expect(store.getSnapshot()).toBe(first);
    expect(store.getServerSnapshot()).toEqual([]);
  });

  it("writes through to storage and notifies subscribers", () => {
    const storage = fakeStorage();
    const store = createTipStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set((current) => [tip("a", 200), ...current]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.data.get(STORAGE_KEY) ?? "[]")).toEqual([tip("a", 200)]);
    expect(store.getSnapshot()).toEqual([tip("a", 200)]);
    unsubscribe();
    store.set([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual([]);
  });

  it("keeps tips in memory when storage is unavailable or full", () => {
    const store = createTipStore(() => {
      throw new Error("blocked");
    });
    expect(store.getSnapshot()).toEqual([]);
    store.set([tip("a", 50)]);
    expect(store.getSnapshot()).toEqual([tip("a", 50)]);
  });
});
