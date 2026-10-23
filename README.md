# Tip Jar

A local tip ledger: pick or type an amount in THB, add a note and "print" a receipt. Receipts and the running total
are kept in this browser's localStorage only. No payment rail is connected: nothing is charged or sent anywhere.

Live: https://donation-tip-jar.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No payments (no Stripe or other provider), no public wall of thanks, no account, no sync between devices.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: ledger logic and storage, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/tip-jar.ts`: tip validation (`createTip`), totals, baht formatting, `parseTips` (drops malformed stored
  entries) and `tipStore`, a small localStorage-backed store the page reads with `useSyncExternalStore` (falls back
  to memory when storage is blocked).
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint. Tips exist only in the browser, so it lists no tools and
  rejects tool calls.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
