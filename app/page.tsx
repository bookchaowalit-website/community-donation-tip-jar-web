"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DENOMINATIONS, NO_RAIL_STATUS, createTip, money, tipStore, totalOf } from "@/lib/tip-jar";

export default function Home() {
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState("Keep shipping demos!");
  const tips = useSyncExternalStore(tipStore.subscribe, tipStore.getSnapshot, tipStore.getServerSnapshot);
  const setTips = tipStore.set;
  const [status, setStatus] = useState(NO_RAIL_STATUS);
  const total = useMemo(() => totalOf(tips), [tips]);

  const recordTip = () => {
    const created = createTip(amount, note, Date.now(), crypto.randomUUID());
    if ("error" in created) { setStatus(created.error); return; }
    setTips((items) => [created.tip, ...items]);
    setStatus(`${money(created.tip.amount)} recorded in this browser.`);
  };

  return <main className="tj-page">
    <header className="tj-topbar"><Link href="/" className="tj-mark">TIP / JAR</Link><span>REGISTER 01 · LOCAL ONLY</span><span className="tj-light"><i /> NO PAYMENT CONNECTION</span></header>
    <section className="tj-hero">
      <div className="tj-hero-copy"><p className="tj-stamp">DEMO LEDGER / RECEIPT STUDY</p><h1>Leave a little<br /><span>signal.</span></h1><p className="tj-intro">Record a tip as a small, visible act of support. This counter remembers entries on this device only; it never pretends to charge anyone.</p><div className="tj-total"><span>LEDGER TOTAL</span><strong>{money(total)}</strong><small>{tips.length} {tips.length === 1 ? "entry" : "entries"} / browser memory</small></div></div>
    <section className="tj-register" aria-labelledby="register-title"><div className="tj-register-head"><span id="register-title">RECORD A TIP</span><b>R-0001</b></div><div className="tj-register-body"><label>AMOUNT <span>THB</span><input aria-label="Tip amount" type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><div className="tj-denoms" role="group" aria-label="Common tip amounts">{DENOMINATIONS.map((value) => <button type="button" key={value} className={amount === value ? "is-active" : ""} onClick={() => setAmount(value)}>{money(value)}</button>)}</div><label>NOTE <input aria-label="Tip note" value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="tj-record" type="button" onClick={recordTip}>PRINT LOCAL RECEIPT <span>↗</span></button><p className="tj-status" role="status">{status}</p></div></section>
    </section>
    <section className="tj-ledger" aria-labelledby="ledger-title"><div className="tj-rule"><span>02 / LEDGER STRIP</span><span>RECENT IMPRESSIONS</span></div><div className="tj-ledger-head"><h2 id="ledger-title">The paper trail.</h2><button type="button" onClick={() => { setTips([]); setStatus("Ledger cleared on this device."); }} disabled={!tips.length}>Clear ledger</button></div><div className="tj-receipts">{tips.length === 0 ? <div className="tj-empty">No receipts yet.<br />Choose a denomination, write a note, and print one above.</div> : tips.map((tip, index) => <article className="tj-receipt" key={tip.id}><span className="tj-receipt-no">{String(index + 1).padStart(2, "0")}</span><div><strong>{money(tip.amount)}</strong><p>{tip.note}</p></div><time dateTime={new Date(tip.at).toISOString()}>{new Date(tip.at).toLocaleDateString("en-GB")}</time></article>)}</div></section>
    <footer className="tj-footer"><strong>DEMO-GRADE / NO PAYMENTS</strong><span>Tip Jar · Bookchaowalit · localStorage only</span></footer>
  </main>;
}
