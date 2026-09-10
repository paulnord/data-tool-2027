# Collision analysis draft

This is an optional review prototype. The normal single-fit analysis remains the default. **Analysis → Collision · before and after** opens an integrated workspace with assignments and fit controls on the right. If columns are missing, use the usual **Data…** button to load or edit them. Load the ordinary `examples/data/collision.csv` file to try it.

Choose one time column and four position columns, assigned to the x and y components of two objects. Starting intervals cover the outer 40% of the time span; they are only suggestions, not collision detection. Adjust both intervals to exclude the impact. Drag a dashed boundary on any position graph to update all four panels, use Left/Right arrow keys on a focused boundary, or enter exact times in the sidebar. All panels share the same time range, including when a position column has missing values. Endpoints are included and intervals must be disjoint. **Fit before and after** runs independent line fits with the existing QR scientific core in a worker. Missing values affect only the corresponding channel; a failed fit is reported without hiding successful fits.

The velocity summary shows the eight slopes, units and standard errors when available. Four aligned position graphs show the two intervals with colors and solid/dashed model lines. Residuals and detailed tables include intercepts, standard errors, slope 95% intervals, sample counts, degrees of freedom, RMS residuals, rank and inference warnings. The usual Copy report and Print controls act on the active analysis. Printing defaults to the summary and four graphs; **Include fit details when printing** adds the complete appendix even if it is collapsed on screen. Each component begins on a fresh page and keeps its residual plot, fit table and explanation together: one summary page followed by four component pages. Source notes remain with the summary. Copying exports a full tab-separated report.

Each column starts with unknown equal scatter, estimated separately for each interval. Choose **Enter position uncertainties** to enter a positive common sigma for each column in its own units. Return to **Estimate scatter from residuals** to stop using those values; entered values are retained when switching uncertainty modes. This prototype does not map per-row uncertainties to the four channels. It does not inherit the single-fit view's exclusions. Known-false exact-time assumptions and known-false independence/correlation for the matching source channel continue to block inference. Conditional uncertainties require explicitly accepting exact time, independent Gaussian errors and straight-line motion within each interval. Neither interval-selection uncertainty nor covariance between fits is modeled. The app does not compute momentum, energy or conservation claims.

Changing a column, interval or uncertainty clears the draft results and disables report export until another fit completes. Returning to the single-fit view preserves that analysis. Switching between single-fit and collision analyses preserves both setups and results while the source table and observations are unchanged. Editing or replacing the source data starts a fresh collision setup. There is no automatic merging of multiple Tracker tracks: supply a table containing all five columns, such as CSV.

## Persistence and compatibility

The report can be copied or printed to PDF. Save session is explicitly disabled in collision mode until a versioned multi-analysis session format is implemented; switch to a single fit to save the source table. Draft settings and results are not saved in `.trksess`; source tables continue to save through the existing single-fit workflow. Existing request, session and acknowledgment schemas are unchanged. There are no native host or Tracker repository changes.

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
