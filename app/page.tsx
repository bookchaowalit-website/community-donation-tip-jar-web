"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop } from "@/components/app-shell";
import { DENOMINATIONS, NO_RAIL_STATUS, createTip, formatDay, money, restoreTips, tipStore, totalOf, type Tip } from "@/lib/tip-jar";

type Undo = { previous: Tip[]; label: string; viaKeyboard: boolean };

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
  const [undo, setUndo] = useState<Undo | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const total = useMemo(() => totalOf(tips), [tips]);

  useEffect(() => { if (undo?.viaKeyboard) undoRef.current?.focus(); }, [undo]);
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
  // The toast closes 6 s after a removal, but never while it holds focus.
  useEffect(() => {
    if (!undo || toastFocused) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
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
  function removeTip(tip: Tip, viaKeyboard: boolean) {
    setUndo({ previous: tips, label: `Removed ${money(tip.amount)}`, viaKeyboard });
    setTips((items) => items.filter((item) => item.id !== tip.id));
    setStatus(`Removed ${money(tip.amount)}. Undo is available for a few seconds.`);
  }
  function clearLedger(viaKeyboard: boolean) {
    setUndo({ previous: tips, label: `Cleared ${tips.length} ${tips.length === 1 ? "tip" : "tips"}`, viaKeyboard });
    setTips([]);
    setStatus("Ledger cleared on this device. Undo is available for a few seconds.");
  }
  function closeToast() {
    setUndo(null);
    setToastFocused(false);
    amountRef.current?.focus();
  }
  function undoLast() {
    if (!undo) return;
    const { previous } = undo;
    setTips((items) => restoreTips(items, previous));
    setStatus("Restored.");
    closeToast();
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
                <li className="as-row" key={tip.id}>
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
          <span>{undo.label}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undoLast}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/community-donation-tip-jar-web" />
    </div>
  );
}
