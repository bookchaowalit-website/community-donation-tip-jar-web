"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop } from "@/components/app-shell";
import { DENOMINATIONS, NO_RAIL_STATUS, createTip, formatDay, money, restoreTips, tipStore, totalOf, type Tip } from "@/lib/tip-jar";

// One remove or clear inside the Undo window. tipId: the removed tip; nextId / prevId: the rows around it, for focus.
type Removal = { label: string; tipId?: string; nextId?: string; prevId?: string };
// Every remove or clear inside the window joins one batch: `previous` is the ledger before the first of them,
// so one Undo brings back everything removed since (tips recorded meanwhile stay on top).
type Undo = { previous: Tip[]; removals: Removal[]; removedCount: number; viaKeyboard: boolean };
const plural = (n: number) => `${n} ${n === 1 ? "tip" : "tips"}`;
const undoLabel = (undo: Undo) => (undo.removals.length === 1 ? undo.removals[0].label : `Removed ${plural(undo.removedCount)}`);

// randomUUID only exists in secure contexts (HTTPS/localhost) and newer browsers.
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `tip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const tips = useSyncExternalStore(tipStore.subscribe, tipStore.getSnapshot, tipStore.getServerSnapshot);
  const setTips = tipStore.set;
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState(NO_RAIL_STATUS);
  const [undo, setUndoState] = useState<Undo | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const pendingRef = useRef<Undo | null>(null);
  const setUndo = (next: Undo | null) => { pendingRef.current = next; setUndoState(next); };
  const focusNext = useRef<string[] | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const total = useMemo(() => totalOf(tips), [tips]);

  useEffect(() => { if (undo?.viaKeyboard) undoRef.current?.focus(); }, [undo]);
  // When the toast closes after Undo or Escape, focus goes back near the removed tip once the ledger has re-rendered:
  // the first of these rows still shown, else the amount field.
  useEffect(() => {
    const ids = focusNext.current;
    if (undo || !ids) return;
    focusNext.current = null;
    const rows = [...document.querySelectorAll<HTMLElement>(".as-row[data-tip]")];
    const row = ids.map((id) => rows.find((entry) => entry.dataset.tip === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".as-danger") ?? amountRef.current)?.focus();
  }, [undo, tips]);
  // Reserve the toast's height at the bottom so a control focused behind it scrolls clear.
  const toastShown = undo !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!undo || toastFocused) return;
    const timer = window.setTimeout(() => { pendingRef.current = null; setUndoState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [undo, toastFocused]);

  function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = createTip(Number(amount), note, Date.now(), createId());
    if ("error" in created) {
      setError(created.error);
      amountRef.current?.focus();
      return;
    }
    setTips((items) => [created.tip, ...items]);
    setError("");
    setNote("");
    setStatus(`${money(created.tip.amount)} recorded in this browser.`);
  }
  /** Add a removal to the pending batch (or start one) and return it. */
  function batch(removal: Removal, next: Tip[], viaKeyboard: boolean): Undo {
    const pending = pendingRef.current;
    const current = tipStore.getSnapshot();
    // A tip recorded since the batch began joins its snapshot, so a later clear can bring it back too.
    const previous = pending ? restoreTips(current, pending.previous) : current;
    const left = new Set(next.map((item) => item.id));
    const removedCount = previous.filter((item) => !left.has(item.id)).length;
    const joined = { previous, removals: [...(pending?.removals ?? []), removal], removedCount, viaKeyboard };
    setUndo(joined);
    setTips(next);
    return joined;
  }
  function removeTip(tip: Tip, viaKeyboard: boolean) {
    const current = tipStore.getSnapshot();
    const index = current.findIndex((item) => item.id === tip.id);
    if (index < 0) return;
    const removal = { label: `Removed ${money(tip.amount)}`, tipId: tip.id, nextId: current[index + 1]?.id, prevId: index > 0 ? current[index - 1].id : undefined };
    const joined = batch(removal, current.filter((item) => item.id !== tip.id), viaKeyboard);
    setStatus(joined.removals.length === 1 ? `Removed ${money(tip.amount)}. Undo is available for a few seconds.` : `Removed ${plural(joined.removedCount)}. Undo is available for a few seconds.`);
  }
  function clearLedger(viaKeyboard: boolean) {
    const current = tipStore.getSnapshot();
    const joined = batch({ label: `Cleared ${plural(current.length)}` }, [], viaKeyboard);
    setStatus(joined.removals.length === 1 ? "Ledger cleared on this device. Undo is available for a few seconds." : `Removed ${plural(joined.removedCount)}. Undo is available for a few seconds.`);
  }
  function closeToast(focusIds?: string[]) {
    const last = pendingRef.current?.removals.at(-1);
    // Dismissed: the row after the removed tip, else the one before it (a clear has none: the amount field).
    focusNext.current = focusIds ?? [last?.nextId, last?.prevId].filter((id): id is string => Boolean(id));
    setUndo(null);
    setToastFocused(false);
  }
  function undoLast() {
    const pending = pendingRef.current;
    if (!pending) return;
    setTips((items) => restoreTips(items, pending.previous));
    setStatus(pending.removals.length === 1 ? "Restored." : `Restored ${plural(pending.removedCount)}.`);
    // Undone: back to the tip removed last (after a clear: the amount field).
    const last = pending.removals.at(-1)?.tipId;
    closeToast(last ? [last] : []);
  }

  const value = Number(amount);

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Tip jar" tagline="A local ledger, no payments" />

      <main id="main" className="as-page">
        <div className="as-head">
          <div>
            <h1>Tip jar</h1>
            <p>Record a tip as a small, visible act of support. Nothing is charged: this ledger lives in this browser.</p>
          </div>
        </div>

        <form className="as-composer" onSubmit={record} aria-label="Record a tip" noValidate>
          <div className="tj-amount">
            <label className="as-field">Amount (THB)
              <input ref={amountRef} type="number" inputMode="numeric" min="1" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} aria-invalid={error ? true : undefined} aria-describedby={error ? "tip-error" : undefined} />
            </label>
            <div className="as-segmented-wrap">
              <span id="denom-label">Common amounts</span>
              <div className="as-segmented" role="group" aria-labelledby="denom-label">
                {DENOMINATIONS.map((option) => (
                  <button key={option} type="button" aria-pressed={value === option} onClick={() => { setAmount(String(option)); setError(""); }}>{money(option)}</button>
                ))}
              </div>
            </div>
          </div>
          <label className="as-field">Note (optional)
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Keep shipping demos!" maxLength={140} autoComplete="off" />
          </label>
          {error ? <p id="tip-error" className="tj-error" role="alert">{error}</p> : null}
          <div className="as-composer-foot">
            <p className="tj-status" role="status">{status}</p>
            <button type="submit" className="as-button">Record tip</button>
          </div>
        </form>

        <section className="as-section" aria-labelledby="ledger-title">
          <div className="as-section-head tj-ledger-head">
            <div>
              <h2 id="ledger-title" className="as-section-title">Ledger</h2>
              <p className="tj-total">Total <strong>{money(total)}</strong> · {tips.length} {tips.length === 1 ? "entry" : "entries"} on this device</p>
            </div>
            {tips.length ? <button type="button" className="as-plain as-danger" onClick={(event) => clearLedger(event.detail === 0)}>Clear ledger</button> : null}
          </div>
          {tips.length ? (
            <ul className="as-list" aria-label="Recorded tips, newest first">
              {tips.map((tip) => (
                <li className="as-row" key={tip.id} data-tip={tip.id}>
                  <div>
                    <h3>{money(tip.amount)}</h3>
                    <p>{tip.note}</p>
                    <p className="as-row-meta"><time dateTime={new Date(tip.at).toISOString()}>{formatDay(tip.at)}</time></p>
                  </div>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove the ${money(tip.amount)} tip`} onClick={(event) => removeTip(tip, event.detail === 0)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              <strong>No tips yet</strong>
              Pick an amount, add a note if you like, and press Record tip.
            </div>
          )}
        </section>

        <p className="as-note">A demo, not a payment page: there is no payment provider, no account and no server. Tips are saved in this browser only.</p>
      </main>

      {undo ? (
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{undoLabel(undo)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undoLast} aria-label={undo.removals.length === 1 ? undefined : `Undo remove of ${plural(undo.removedCount)}`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/community-donation-tip-jar-web" />
    </div>
  );
}
