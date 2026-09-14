# Usability and visual-design audit — 12 September 2026

## Scope and method

This audit examines the running local app, including the earlier row-label,
numeric-entry, diagnostic-wording, and menu-alignment fixes. The inventory below
was recorded **before this audit's implementation changes**. Findings come from
rendered interfaces and reproducible interactions, not only source inspection or
passing functional tests.

Four reviewers divided the first-use/data workflow, publication workflow,
multiple-fit workflows, and cross-application keyboard/accessibility behavior.
They used separate Chrome sessions against `http://127.0.0.1:5174/`, preserving the
user's open Mac session. Normal and short windows were tested at 1440 × 1000,
1366 × 768, 900 × 700, and 800 × 700, with applicable 100%, 150%, and 200% interface
sizes. Exported figures and representative printed PDFs were rendered and
visually inspected. No participant study or journal-acceptance certification is
implied.

Local screenshots, PDFs, and recorded measurements are in
`/tmp/data-tool-ux-audit/{root,import,publication,multifit}/`. The reproduction
steps below remain useful if those temporary artifacts are removed.

## Initial findings

Priority 1 means a risk of losing work, silently acting on the wrong state, or
producing a visibly defective publication figure. Priority 2 materially hinders
an ordinary workflow. Priority 3 concerns clarity or consistency.

| ID  | Priority | Finding and reproduction                                                                                                                                                                                                                        | Intended correction                                                                                                     |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| U01 | 1        | Multi-interval/collision edits and fits do not activate the unsaved-work guard. Edit a boundary or fit, then attempt to close/reload; draft work is unprotected while Save is disabled.                                                         | Include draft work in close/replacement protection without claiming that sessions can save it.                          |
| U02 | 1        | Fit interval 3, reduce the interval count to 2, then restore 3. Its range and result disappear with no undo.                                                                                                                                    | Retain temporarily hidden interval configurations/results so restoring the count restores work.                         |
| U03 | 1        | Edit a custom equation in one interval, switch tabs before Apply, and return. The pending expression is silently lost.                                                                                                                          | Preserve drafts by interval or require explicit resolution before leaving.                                              |
| U04 | 2        | Multi-interval parameter inputs still reject a blank or leading minus. Starting at 0, clear, type `-`, then `2`; the field becomes positive `02`.                                                                                               | Reuse validated decimal/scientific draft entry.                                                                         |
| U05 | 1        | Cmd/Ctrl+P inside Data opens a report for the previous analysis above the staged table. Cmd/Ctrl+Z on Figure size's preset selector undoes the analysis behind the modal. Cmd/Ctrl+P in print preview does not invoke printing.                 | Keep shortcuts within their active dialog and make preview printing work.                                               |
| U06 | 2        | Examples is a flat list of 29 items; 14 synthetic examples precede published data and hidden scrolling does not advertise more choices. Explicitly raised by the user during this audit.                                                        | Keep Synthetic data and Published data categories visible, with one scrollable list and a visible more-items cue.       |
| U07 | 2        | Launching the untouched app shows an orange header-row warning. New table has a different, calmer empty state.                                                                                                                                  | Explain how to enter/load data in the empty state; reserve validation errors for actual invalid input.                  |
| U08 | 2        | Use these data looks like Cancel and other secondary actions because a generic button selector overrides its primary styling.                                                                                                                   | Restore a clear primary action.                                                                                         |
| U09 | 2        | At 1366 × 768 and 150–200%, Data instructions and setup controls occupy most of the initial dialog; observations require scrolling and the actions scroll away.                                                                                 | Shorten the initial guidance, disclose detailed editing help, and improve action/data reachability.                     |
| U10 | 2        | Enlarged Examples and column menus extend beyond Data; using Examples at 200% requires scrolling both menu and surrounding dialog. X/Y popovers similarly extend below a short viewport, and scrolling to Apply moves upper controls offscreen. | Fit popovers to the visible space, accounting for interface scale; scroll the menu internally.                          |
| U11 | 2        | At 900 × 700 and 200%, the fixed 320 CSS-pixel sidebar leaves approximately 100 CSS pixels for multi/collision plots. Physical-width media queries miss the effective width.                                                                    | Make responsive layouts account for the scaled content width.                                                           |
| U12 | 2        | An invalid range in interval 2 disables fitting a valid interval 1.                                                                                                                                                                             | Validate the selected interval independently when running its fit.                                                      |
| U13 | 2        | Overlapping collision ranges remove all four graphs, taking away the visual context needed to repair the ranges.                                                                                                                                | Keep source observations visible during invalid configuration edits.                                                    |
| U14 | 2        | Supplied collision uncertainties use an Estimate placeholder and advise leaving a field blank, but blanks disable Fit.                                                                                                                          | State the implemented requirement for positive supplied uncertainties accurately.                                       |
| U15 | 2        | After a nonlinear fit, guidance still calls the displayed fitted coefficients “starting estimates.”                                                                                                                                             | Make guidance reflect whether values are initial, manually edited, or fitted.                                           |
| U16 | 1        | An unapplied custom equation disables Fit/Save but still permits copying/printing/exporting the previous fitted equation without an explicit distinction.                                                                                       | Prevent outputs from being mistaken for the pending equation's results.                                                 |
| U17 | 2        | Export successfully, then request a 50 × 40 mm PNG with 14 pt labels. The useful sizing error appears while the earlier “Graph exported” status remains visible.                                                                                | Clear stale success feedback when a new export starts or fails.                                                         |
| U18 | 2        | Closing Data, Print report, or Figure size with Escape leaves keyboard focus on the page body.                                                                                                                                                  | Return focus to the invoking control, including the Export menu trigger.                                                |
| U19 | 2        | Interface size 200% enlarges the app but the fitting guide remains at 15 px and its tooltip remains at 13 px.                                                                                                                                   | Honor interface scale in the help surfaces while keeping them within the viewport.                                      |
| U20 | 3        | Malformed-file errors expose parser output without naming the file or clearly saying the current data were kept. Actual preservation/recovery works.                                                                                            | Give a concise contextual message with technical detail available separately.                                           |
| U21 | 3        | Excluded points use gray open markers, but their tooltips do not state Included/Excluded and there is no explanatory key.                                                                                                                       | Explain the existing encoding accessibly without changing observations or exports' scientific meaning.                  |
| U22 | 3        | Menus advertise menu/menuitem semantics but ArrowDown does not enter/navigate them; only Tab works.                                                                                                                                             | Provide keyboard behavior consistent with the menu presentation.                                                        |
| U23 | 1        | Published DyFeO₃ data exported at the default 85 × 60 mm size clips `Residual [arb. u.]` in both PNG and PDF. Square and data-only figures fare better.                                                                                         | Keep the entire residual-axis label inside the exact requested figure dimensions with readable, undistorted typography. |

Settings initially appeared clipped in one screenshot, but measurements after
layout settled confirmed correct clamping and internal scrolling. It is **not**
included as a persistent defect.

## Follow-up findings during implementation

- **U24 · Priority 1 · Fixed:** the untouched startup grid contains only X/Y
  headings. Pasting a headerless numerical block at Row 1, column 1 previously
  kept the heading count at one and omitted the first observation. Initial paste
  now detects an observation-free table, infers headings, and preserves every
  numerical row. Empty heading metadata also passes native input validation.
- **U25 · Priority 2 · Remaining:** fit an interval, switch to a single fit,
  change Source notes, then return. The interval workspace and copied report
  retain the earlier source notes. The fit's source snapshot and subsequent
  amendments need an explicit policy; simply changing the visible notes would
  leave copied fit-request provenance inconsistent. Reproduction evidence is in
  `multifit/source-metadata-evidence.json` under the local evidence directory.

## Implemented corrections

U01–U24 have bounded corrections in the local build. The major changes are:

- **Examples and data entry:** visible Synthetic data (14) and Published data
  (15) categories, a single scrolling list, a more-items cue, and keyboard
  navigation. Data keeps Cancel and Use these data visible while scrolling,
  marks the primary action clearly, and discloses detailed editing help.
  At 200% scale the observations still require scrolling; controls remain
  reachable. Empty startup is neutral and initial pasted observations are kept.
- **Work preservation:** closing/replacing work respects unsaved interval and
  collision drafts. Saving only the source does not clear that protection.
  Applying table edits requires an explicit choice before resetting interval
  work. Reducing the interval count hides and retains the extra intervals;
  global scientific changes invalidate hidden results as well as visible ones.
  Pending custom equations survive interval changes.
- **Editing and feedback:** interval numbers accept incremental negative and
  scientific notation, valid intervals fit independently, invalid collision
  ranges retain raw graphs, and supplied-sigma wording matches validation.
  Fitted coefficients are described as fitted. Pending single-fit equations
  clearly suspend reports and exports. Failed imports name the file, explain
  preservation, and disclose parser details separately. Failed exports clear
  previous success messages.
- **Keyboard and enlarged interfaces:** dialog shortcuts stay within the
  active dialog, preview's print shortcut works, closing restores focus, and
  menus implement arrow-key navigation. Enlarged multi-fit graphs retain useful
  width; axis and Data popovers fit the available viewport. Guide and tooltip
  text follow interface scale. Point tooltips explain inclusion/exclusion.
- **Publication figures:** residual units use a second title line when needed
  for physical exports. Shared margins retain identical frame widths and exact
  requested dimensions. Actual font metrics are checked before export,
  including the embedded PDF font; a title that cannot fit produces a clear
  sizing error rather than missing text. PNG/PDF output was visually rechecked.

## Larger design decisions

These are distinct from the bounded corrections above:

- **Saving multiple-fit work:** `.trksess` currently does not save multi-interval
  or collision setup/results. Adding that requires a documented session design
  and compatibility work. A close warning is useful protection, not persistence.
- **One print-preview experience:** multiple-fit modes currently open their
  printable report directly; they do not use the single-fit preview and its
  full-page switch. Unifying these needs a shared report/preview design.
- **Figure-size preview:** users must export and inspect a file to judge a new
  physical size. A live preview would improve this workflow but is a new feature.
- **Report presets:** Technical report and Compact report choose sections, yet
  look like immediate actions and do not explicitly show a current/custom preset.
  A clearer preset control deserves a separate small design review.
- **Dense multi-fit setup:** even without clipping, stacked assignment controls
  can occupy more than a screen before graphs. A concise setup summary could
  help once the user has configured the analysis.
- **Assumption acceptance and help:** the checkbox caption currently opens the
  guide instead of toggling the checkbox. A conventional clickable label plus a
  distinct help control would make the two actions clearer; retain the explicit
  meaning of accepting unverified assumptions.

## Coverage and successful behavior

| Area              | Exercised                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start and data    | Empty startup, New table, file/session loading, TSV paste, headings, X/Y/σ assignments, case-sensitive units, numeric errors, Go to cell, duplicate-axis rejection, copy/selection, context menu, examples, cancel, replacement confirmation, failed import, notes, save/reopen. |
| Single fit        | Published and synthetic files, nonlinear fits, fixed/free parameters, custom equation drafts, stale and completed states, assumptions, exclusions, diagnostics, error recovery.                                                                                                  |
| Presentation      | Display/Settings/Export/X/Y menus; normal/short/enlarged layouts; valid and invalid limits; logarithmic axes; residual visibility; menu dismissal and keyboard focus.                                                                                                            |
| Publication       | Single-column, double-column, square, and data-only SVG/PNG/PDF downloads; invalid physical size; standard/full-page print; representative rasterized PDFs and actual PNGs.                                                                                                      |
| Multiple fits     | Three-interval oil-drop workflow, four-series/five-interval maximum (20 successful fits), count changes, tab changes, parameter/equation edits, valid/invalid ranges, keyboard boundary handles, summary/detail reports and copy.                                                |
| Collision         | Eight before/after fits, shared boundaries, keyboard adjustment, overlapping ranges, supplied/estimated uncertainties, error recovery, mode switching, copied and printed reports.                                                                                               |
| Cross-application | Shortcuts inside/outside modals, focus after Escape, help navigation and interface scaling, preservation of staged data and canonical analysis.                                                                                                                                  |

Observed successes include exact row/unit preservation through save/reopen,
cancel keeping the prior analysis, rejected imports retaining current data,
independent fitted intervals retaining other successful results during ordinary
edits, aligned main/residual plot frames, and intact representative multi-fit
printed pages. The maximum-size multi-fit reports were generated; not every
page of their 23-page detail output was visually inspected.

## Verification and remaining limits

The affected workflows were repeated after editing, including actual exported
PNG/PDF inspection, enlarged menus, dialog focus/shortcuts, exact interval
restoration, and staged-data protection. Regression coverage was added for these
behaviors, alongside existing numerical and compatibility checks.

- `npm test`: **201 passed** across 26 files.
- `npm run test:e2e -- --workers=4`: **131 passed**.
- `npm run build`: passed through the desktop build's required pre-build step.
- `npm run desktop:build`: passed; the local Mac bundle was rebuilt and its
  ad-hoc signature verified. Native host source was unchanged.

The local development build is available at `http://127.0.0.1:5174/`. No release
was created or pushed. The user's running Mac process was left intact; it needs
save/restart to use the rebuilt bundle.

Native operating-system file dialogs, physical printers, screen-reader speech,
and independent Windows/Linux interactive sessions are outside this local
walkthrough. The user's running Mac session was not used for destructive tests.
