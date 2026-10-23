# Tip Jar — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `donation-tip-jar`, evidence Live→Prototype)
> on 2026-10-23.

## What it is

A client-only demo of a tip register that records "receipts" in the visitor's own browser. The page says
"No payment rail connected" and never charges anyone.

## Who it is for

A portfolio visitor who wants to see a small receipt-style ledger UI.

## What works today

1. Choose ฿50 / ฿100 / ฿200 / ฿500 or type an amount, add a note, and record a tip. Zero, negative or empty amounts
   are refused with a message.
2. The ledger lists receipts newest first with the running total and entry count, and can be cleared.
3. Tips are saved in localStorage (`tip-jar-v2`) on this device; malformed saved data is ignored instead of
   breaking the page. Changes in another tab show up through the `storage` event.
4. `/api/mcp` answers JSON-RPC `initialize` and `tools/list` (no tools: the server has no ledger) and rejects tool
   calls.
5. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No Stripe Payment Links or any payment provider, no public wall of thanks, no monetisation across projects (claims
  removed from the portfolio card in the 2026-10 review).
- No account, server storage or sync. No product analytics beyond Vercel Analytics.

## Live URL and deploy state

- Live: https://donation-tip-jar.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-donation-tip-jar-frontend` is deployed only by CLI (last production 2026-10-23
  12:02 +07, the CVE patch, commit fc4e3bd) and its Git link names the old repository
  (`bookchaowalit/bookchaowalit-donation-tip-jar-frontend`), so a push to `main` does not deploy. The live site lags
  `main` (no Sentry, old template MCP route, unvalidated storage) until the owner reconnects Vercel Git to this
  repository (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is already set on the Vercel project (Sentry project
  `community-donation-tip-jar-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route. No money moves.
