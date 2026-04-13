# Step 5 — NRR Implementation Notes

Date: 2026-04-13

## What was implemented

- Added shared NRR utility: `src/utils/nrr.js`
  - `oversToBalls`
  - `inningsBallsFaced` (all-out full quota rule)
  - `calculateNRR`
- Integrated shared NRR math into:
  - `src/components/TournamentTabs/PointsTab.jsx`
  - `src/utils/statsHelper.js`
- Added deterministic NRR vector check script:
  - `scripts/step5-nrr-check.mjs`
  - run with `npm run step5:nrr`

## Rule baseline

- NRR = RR For - RR Against
- RR is computed from **balls-based rate** for consistency.
- If innings is all out, balls faced use full quota (`maxOvers * 6`) by default.

