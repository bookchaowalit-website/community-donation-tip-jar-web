# Design direction

## Product world

Donation Tip Jar is a tiny cash-register ledger. The receipt strip, register number, denomination buttons, and printed local receipt turn an abstract “tip” into a visible record while staying explicit that no payment rail is connected.

## Visual system

- Palette: ink violet `#171329`, warm paper `#f6f0e5`, receipt yellow `#f4c95d`, mint `#b8edca`, and muted lavender `#b8b2d3`.
- Type: `Space Grotesk` for the human headline and `IBM Plex Mono` for amounts, labels, and ledger details.
- Composition: offset register card, large left-aligned statement, a denomination rail, and a receipt-like paper trail.
- Motion: quiet state changes for selected denominations and newly printed receipts, with reduced-motion support.

## Interaction and boundary

Users can choose a denomination, enter an amount and note, then print a local receipt. Entries persist in `localStorage` on the current device. Clear ledger is available only when records exist; there is no charge, transfer, authentication, or server sync.

## Responsive behavior

The register and ledger become a single vertical workflow on small screens. Inputs and denomination controls remain easy to tap, and the receipt list stays within the viewport.


---

## Storybook

Storybook 10 (`@storybook/nextjs-vite`) shows this design system with the app's real CSS, tokens and fonts.

```bash
npm run storybook        # http://localhost:6006
npm run build-storybook  # static build in storybook-static/ (CI: .github/workflows/storybook.yml)
```

- **Foundations/Tokens** reads every CSS custom property the app defines at runtime, so it never drifts from the code.
- **Design/DESIGN.md** renders this file.
- **Components/**, **Sections/** and **Pages/** show the UI with mock data only (no network, analytics off).
- Toolbar: locale, theme (light / dark, when the app has a dark theme), viewports 320 / 375 / 768 / 1440. The a11y panel runs axe (WCAG 2.2 AA).
- Rule: a new shared component or page section ships with a story in `stories/`.
