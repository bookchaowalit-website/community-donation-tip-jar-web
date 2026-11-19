# Design

Since 2026-11-19 the tip jar uses the shared **App shell** (see `APP-SHELL.md`; `app/app-shell.css` and `components/app-shell.tsx` are copied byte for byte
from the reference site). It replaced the earlier one-off look, whose small uppercase labels, unloaded or
render-blocking fonts and low-contrast text failed the design floor (review 2026-11-11).

- One column (`.as-page`): head (h1 and one line on what the page is), the record form as an always-open
  composer card (amount, common amounts as a segmented control, optional note, **Record tip**), then the
  ledger with its total, rows newest first and a plain Clear ledger.
- Record tip is the one filled button and sits in the first phone viewport. A bad amount shows an error
  under the form and focuses the field.
- Remove and Clear ledger are undoable for a few seconds (toast with Undo); no confirm dialog.
- Colours are the shell tokens only; the old purple/yellow palette (and its mismatch with this file) is gone.

Floor: Geist via `next/font` (variable on `<html>`), text ≥ 12px, controls ≥ 44px, 4.5:1 text contrast in
light and dark, 3px focus ring, forced-colors support, no horizontal scroll at 320px. `/more-projects`
redirects (308) to https://bookchaowalit.com/ and the footer links there.
