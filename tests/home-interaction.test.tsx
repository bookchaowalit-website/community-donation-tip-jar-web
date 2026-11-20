// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { STORAGE_KEY, tipStore } from "@/lib/tip-jar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
const press = (el: Element, detail = 0) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
// Remove buttons are named "Remove tip N of M: ฿amount, note, date"; these tests use distinct amounts.
const removeOf = (amount: string) => [...host.querySelectorAll<HTMLButtonElement>(".as-row .as-danger")].find((b) => b.getAttribute("aria-label")?.includes(`: ${amount},`)) as HTMLButtonElement;
const submit = () => act(() => { $<HTMLFormElement>(".as-composer")!.requestSubmit(); });
function type(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  tipStore.set([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("recording", () => {
  it("records the chosen amount with a note, updates the total and stores it", () => {
    press(button("฿200"));
    expect(button("฿200").getAttribute("aria-pressed")).toBe("true");
    type($<HTMLInputElement>('input[maxlength="140"]')!, "Thanks!");
    submit();
    expect(rows()).toEqual(["฿200"]);
    expect(host.textContent).toContain("Total ฿200");
    expect(host.textContent).toContain("฿200 recorded in this browser.");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0]).toMatchObject({ amount: 200, note: "Thanks!" });
  });

  it("shows an error and focuses the amount when it is not above zero", () => {
    type($<HTMLInputElement>('input[type="number"]')!, "0");
    submit();
    expect($('[role="alert"]')!.textContent).toContain("greater than zero");
    expect(document.activeElement).toBe($('input[type="number"]'));
    type($<HTMLInputElement>('input[type="number"]')!, "5");
    expect($('[role="alert"]')).toBeNull();
  });

  it("opens a phone keypad with a decimal point and records an amount with satang", () => {
    const field = $<HTMLInputElement>('input[type="number"]')!;
    expect(field.getAttribute("inputmode")).toBe("decimal");
    type(field, "50.50");
    submit();
    expect(rows()).toEqual(["฿50.5"]);
  });

  it("still records without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", {});
    try {
      submit();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].id).toMatch(/^tip-\d+-[a-z0-9]+$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("remove, clear and undo", () => {
  it("Remove buttons tell tips with the same amount apart", () => {
    type($<HTMLInputElement>('input[maxlength="140"]')!, "First");
    submit();
    type($<HTMLInputElement>('input[maxlength="140"]')!, "Second");
    submit();
    const names = [...host.querySelectorAll(".as-row .as-danger")].map((b) => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(2);
    expect(names[0]).toMatch(/^Remove tip 1 of 2: ฿100, Second, /);
    expect(names[1]).toMatch(/^Remove tip 2 of 2: ฿100, First, /);
  });

  it("Remove is undoable and keeps the order", () => {
    press(button("฿50")); submit();
    press(button("฿500")); submit();
    press(removeOf("฿50"));
    expect(rows()).toEqual(["฿500"]);
    expect(document.activeElement).toBe(button("Undo"));
    press(button("Undo"));
    expect(rows()).toEqual(["฿500", "฿50"]);
    expect($(".as-toast")).toBeNull();
  });

  it("Clear ledger is undoable; Escape and the timer close the toast", () => {
    submit(); submit();
    press(button("Clear ledger"));
    expect(host.textContent).toContain("No tips yet");
    expect(host.textContent).toContain("Cleared 2 tips");
    press(button("Undo"));
    expect(rows()).toHaveLength(2);
    press(button("Clear ledger"));
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    submit();
    vi.useFakeTimers();
    press(button("Clear ledger"), 1);
    expect(host.textContent).toContain("Cleared 1 tip");
    act(() => { vi.advanceTimersByTime(6100); });
    expect($(".as-toast")).toBeNull();
  });
});

describe("batch Undo", () => {
  const escape = () => act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });

  it("consecutive removes restore together with one Undo", () => {
    vi.useFakeTimers();
    press(button("฿50")); submit();
    press(button("฿100")); submit();
    press(button("฿500")); submit();
    expect(rows()).toEqual(["฿500", "฿100", "฿50"]);
    press(removeOf("฿100"), 1);
    act(() => { vi.advanceTimersByTime(4000); });
    press(removeOf("฿500"), 1);
    expect(rows()).toEqual(["฿50"]);
    expect($(".as-toast span")!.textContent).toBe("Removed 2 tips");
    expect(button("Undo").getAttribute("aria-label")).toBe("Undo remove of 2 tips");
    // The second removal restarted the 6 s window: 4 s later it is still open.
    act(() => { vi.advanceTimersByTime(4000); });
    press(button("Undo"), 1);
    expect(rows()).toEqual(["฿500", "฿100", "฿50"]);
    expect($(".as-toast")).toBeNull();
    expect(host.textContent).toContain("Restored 2 tips.");
  });

  it("a remove then a clear inside the window restore together, keeping a tip recorded in between", () => {
    press(button("฿50")); submit();
    press(button("฿100")); submit();
    press(removeOf("฿50"), 1);
    press(button("฿500")); submit();
    press(button("Clear ledger"), 1);
    expect($(".as-toast span")!.textContent).toBe("Removed 3 tips");
    press(button("Undo"), 1);
    expect(rows()).toEqual(["฿500", "฿100", "฿50"]);
  });

  it("Undo brings back only the tips this tab removed, not one another tab removed meanwhile", () => {
    press(button("฿50")); submit();
    press(button("฿100")); submit();
    press(button("฿500")); submit();
    press(removeOf("฿50"), 1);
    // Another tab removes the ฿100 tip while this tab's Undo is still open.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { amount: number }[];
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((item) => item.amount !== 100)));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    expect(rows()).toEqual(["฿500"]);
    press(button("Undo"), 1);
    expect(rows()).toEqual(["฿500", "฿50"]);
    expect(host.textContent).toContain("Total ฿550");
  });

  it("Undo after a clear restores only what the clear removed", () => {
    press(button("฿50")); submit();
    press(button("฿100")); submit();
    // Another tab removes the ฿100 tip before this tab clears the (stale) ledger.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { amount: number }[];
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((item) => item.amount !== 100)));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    press(button("Clear ledger"), 1);
    expect($(".as-toast span")!.textContent).toBe("Cleared 1 tip");
    press(button("Undo"), 1);
    expect(rows()).toEqual(["฿50"]);
  });

  it("keyboard remove focuses Undo; Undo focuses the restored tip, Escape the next one", () => {
    press(button("฿50")); submit();
    press(button("฿100")); submit();
    press(removeOf("฿100"), 0);
    expect(document.activeElement).toBe(button("Undo"));
    press(button("Undo"), 0);
    expect(document.activeElement).toBe(removeOf("฿100"));
    press(removeOf("฿100"), 0);
    escape();
    expect(document.activeElement).toBe(removeOf("฿50"));
    // Nothing left to land on, or a clear: the amount field.
    press(button("Clear ledger"), 0);
    expect(document.activeElement).toBe(button("Undo"));
    press(button("Undo"), 0);
    expect(document.activeElement).toBe($('input[type="number"]'));
  });
});
