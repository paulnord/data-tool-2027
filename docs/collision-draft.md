# Collision analysis draft

This is an optional review prototype. The normal single-fit analysis remains the default. **Analysis tools → Collision · before and after** opens an integrated workspace with assignments and fit controls on the right. If columns are missing, use the usual **Data…** button to load or edit them. Load the ordinary `examples/data/collision.csv` file to try it.

Choose one time column and four position columns, assigned to the x and y components of two objects. Starting intervals cover the outer 40% of the time span; they are only suggestions, not collision detection. Adjust both intervals to exclude the impact. Drag a dashed boundary on any position graph to update all four panels, use Left/Right arrow keys on a focused boundary, or enter exact times in the sidebar. All panels share the same time range, including when a position column has missing values. Endpoints are included and intervals must be disjoint. **Fit before and after** runs independent line fits with the existing QR scientific core in a worker. Missing values affect only the corresponding channel; a failed fit is reported without hiding successful fits.

The velocity summary shows the eight slopes, units and standard errors when available. Four aligned position graphs show the two intervals with colors and solid/dashed model lines. Residuals and detailed tables include intercepts, standard errors, slope 95% intervals, sample counts, degrees of freedom, RMS residuals, rank and inference warnings. Copy fits exports one row per fitted component and interval; Copy positions exports the original time and position values with phase selections. Print still provides summary plots and optional full diagnostic details. Neither copy action modifies data or accepts uncertainty assumptions. See the clipboard tables below.

Each column starts with unknown equal scatter, estimated separately for each interval. Choose **Enter position uncertainties** to enter a positive common sigma for each column in its own units. Return to **Estimate scatter from residuals** to stop using those values; entered values are retained when switching uncertainty modes. This prototype does not map per-row uncertainties to the four channels. It does not inherit the single-fit view's exclusions. Known-false exact-time assumptions and known-false independence/correlation for the matching source channel continue to block inference. Conditional uncertainties require explicitly accepting exact time, independent Gaussian errors and straight-line motion within each interval. Neither interval-selection uncertainty nor covariance between fits is modeled. The app does not compute momentum, energy or conservation claims.

Changing a column, interval or uncertainty clears the draft results and disables report export until another fit completes. Returning to the single-fit view preserves that analysis. Switching between single-fit and collision analyses preserves both setups and results while the source table and observations are unchanged. Editing or replacing the source data starts a fresh collision setup. There is no automatic merging of multiple Tracker tracks: supply a table containing all five columns, such as CSV.

## Persistence and compatibility

**Save session** writes the complete source table and active collision setup in a
v7 `.trksess`: all five column assignments, both windows, uncertainty mode and
values, assumption acceptance, plot limits and detail preferences. Reopen it
through Data review, then press **Fit before and after** to recalculate results.
Invalid column assignments, windows or uncertainties block saving. Reports are
still copied or printed separately. See the [current format](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15);
request/ack v1 remains unchanged; only session v7 is supported.

## Rollback

Pre-draft copies of `src/fit/FitApp.tsx` and `README.md` are in the ignored `.tools/rollback-collision-draft/` directory. All implementation is isolated to the following additions plus the launch control in `FitApp.tsx` and the README link:

- `src/core/fit/collision.ts`
- `src/fit/CollisionDraft.tsx`, `src/fit/collision.worker.ts`, `src/fit/collision.css`
- `tests/fit/collision.test.ts`, `e2e/collision.spec.ts`
- `tests/support/generate-collision-example.py`, `examples/data/collision.csv`
- This document

To roll back, restore the two pre-draft files and remove these additions, then rebuild the app. If other edits have happened since this draft, remove only the draft's changes rather than overwriting those edits. The backup excludes generated app bundles; rebuilding restores the prior UI.

## Integrated-workflow rollback checkpoint

The previous modal draft is preserved in `.tools/rollback-collision-workflow/` (FitApp.tsx, CollisionDraft.tsx, collision.css, collision.spec.ts, README.md and this document). The other browser tests only rename the model selector label from Model to Analysis. No scientific solver or protocol schema was changed by the integrated workflow.

Printing uses normal block flow in document order, with legacy and modern page-break properties. The collision print ancestors disable flex layout and CSS containment for the Mac webview. Browser PDF checks cover the expected five pages; native printer pagination still needs checking in the Mac print dialog.

## Clipboard tables

**Copy positions** produces a plain six-column TSV: Time (actual unit), Object 1 x/y (actual units), Object 2 x/y (actual units), Phase. The first row is headings, followed by every original data row in source order, without a row limit or numeric rounding. Phase is Before, After or Exclude from the actual shared inclusive selections. Missing/invalid positions exclude only their own component, not other axes. Invalid time is Exclude. Overlapping or divergent selections are rejected, not guessed. Object 1/2 mean the assigned pairs in the collision workspace.

**Copy fits** produces headings and eight rows, ordered Before then After, with Object 1 x/y then Object 2 x/y in each phase. Columns are Object, Phase, Axis, N, Velocity, Velocity σ, Intercept, R², From, To, Uncertainty method, Position σ, Source column, Notes. Units appear in numeric headers when shared across channels. For mixed units, headers say source units and three extra columns give each row's Velocity unit, Position unit and Time unit. No conversion or relabeling to SI is performed. Match the destination's units before using values.

Velocity is the line slope; position = intercept + velocity × time. Velocity σ is its standard error conditional on the app's inference assumptions. Residual-based scatter is estimated separately for each interval; supplied position precision uses the entered common sigma for that channel. Position σ says Not supplied for residual-based fits. Unavailable fits/statistics are explicit text, never zero; Notes explains failures or unavailable statistics. N is the usable observation count for that specific axis. Source column preserves the original channel label. Detailed warnings, covariance and inference diagnostics remain in the app and Print. Cross-fit covariance and interval-selection uncertainty are not modeled.

Paste each table at the beginning of its destination range, clearing previous contents first if replacing a longer dataset. There are no special-cell metadata offsets, repeated velocity summaries, masses, momentum or energy calculations in these exports. Text that could execute as spreadsheet formulas is escaped; numeric precision is retained. This changes clipboard presentation only, not the session format or scientific calculations.
