---
name: Tip management architecture
description: How tips (mance) are stored, calculated and printed in Derby Admin — local-only, per-day, per-device.
---

## Rule
Tips are NOT in the Rosso Fuoco Console API — they must be entered manually by the manager in the Cassa screen each day.

**Why:** The POS daily-summary (`/api/reports/daily-summary`) returns cash/card/gc revenue totals but no tip fields. Tips are saved locally in AsyncStorage keyed by date (`@derby_tip_data_YYYY-MM-DD`) via `services/tipStorage.ts`.

## How to apply
- `context/TipContext.tsx` — React context wrapping the whole `(main)` layout via `TipProvider` in `app/(main)/_layout.tsx`.
- `services/tipStorage.ts` — persistence, calculation, receipt text generation (Polish law compliant: art. 12 ustawy z 26.07.1991 r. o p.d.o.f.).
- `app/(main)/cassa.tsx` — UI: card/cash totals from API + manual tip entry + distribution calculator + print buttons.
- `app/(main)/settings.tsx` — configurable distribution percentages (Sala/Cucina/Bar/Fondo, must sum to 100%) and electronic tip tax rate (default 30%).
- Electronic tips (card/POS) are taxed at the configured rate before distribution; cash tips are distributed gross.
- Printing uses `sendPrinterMessage` from `derbyApi.ts` — sends formatted plain-text to thermal printer.
- The summary screen (`app/(main)/summary.tsx`) uses `useTip()` to show tip totals synced with the selected date.
