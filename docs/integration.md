# Tracker ↔ Data Tool integration

Data Tool 2027 is a separate desktop process. Tracker owns video decoding, calibration and digitization; Data Tool receives an immutable numerical snapshot. No Java classes, shared UI, decoder or network service crosses the boundary.

## Current file formats

Continue using the published strict schemas in `schemas/`:

- `tracker-fit-request.v1.json`: one numerical dataset, explicit units and uncertainty/provenance.
- `tracker-fit-session.v7.json`: the only supported session format, for single fits and every workspace; retains the `.trksess` extension.
- `tracker-fit-ack.v1.json`: import accepted or error, correlated by request UUID.

The `tracker-fit-*` names are protocol identifiers, not branding. Keeping them avoids breaking existing files or adapters. New incompatible fields require a new version and documented migration. Request and snapshot UUIDs are opaque identities; the current implementation does not claim they are content hashes. Physical derived quantities from Tracker arrive as labeled analysis inputs, never as new raw measurements.

## Launch

From this checkout:

```sh
./bin/data-tool-2027 --open '/absolute/path/experiment.json' --ack '/absolute/path/experiment.ack.json'
```

The launcher executes `Data Tool 2027.app/Contents/MacOS/data-tool-2027`. A packaged Tracker adapter should locate the installed application rather than assume this checkout path. The executable also accepts a positional input filename and tolerates the former `--fit` switch. One launch accepts one input; launch another process for an independent analysis. CSV/TSV/TXT and Tracker TRK/TRZ inputs are supported with `--open` but do not use the JSON acknowledgment protocol. Tracker projects stage a track-selection review; see [supported project data and timing limits](tracker-import.md).

On macOS, this also works:

```sh
open -n '/path/to/Data Tool 2027.app' --args --open '/path/to/request.json' --ack '/path/to/request.ack.json'
```

Opening a `.trksess` document through macOS delivers it to the Data review workflow. Multiple files delivered together open additional processes. The CLI is the tested integration entrypoint; file associations depend on macOS registration and should be manually checked after installation.

A Java adapter can use `new ProcessBuilder(executable, "--open", requestPath, "--ack", ackPath).start()` on a worker thread. Pass each argument separately; do not assemble shell commands. Do not call `waitFor()` or poll files on Swing's EDT. Tracker should write and close its payload before launch, use unique request/ack paths, check acknowledgment UUID and status, and impose a reasonable startup timeout (for example 30 seconds). The GUI process remains alive after acknowledging, so process exit is not a fit-completion signal.

## Acknowledgment semantics

`accepted` means the full TypeScript schema and semantic validation passed and the data was staged for user review. It does not mean the user has accepted the review, executed a fit or saved results. Data Tool never modifies the input file. Acknowledgments and exports use temporary files and atomic replacement.

Validation failure produces `error` and a message. If a request UUID is readable it is echoed; an unreadable/missing UUID uses the all-zero UUID. Unsupported CLI arguments exit with status 2 before opening a window. An unwritable acknowledgment destination is reported in the app; Tracker must still handle timeout or early process exit. The adapter owns cleanup of its exchange files and should remove them after acknowledgment. Never use the request path as the acknowledgment path.

This release does not automatically send fitted parameters back to Tracker. The user can save a session or copy/export a report. A later explicit result-message protocol can add that behavior without coupling the applications.

## Validation

`npm run test:integration` launches the actual release app with a request, current single-fit and multi-fit sessions, an unsupported session version and an invalid request, checks accepted/error acknowledgment files and request IDs, then terminates only the test-owned processes. There are no production smoke commands or environment-controlled test data paths. Windows/Linux portability is an architectural target; only macOS binaries have been built here.

## One session format: v7 — pre-beta migration, 2026-09-15

Session v7 replaces all six development formats. The app reads and writes only
`format: "tracker-fit-session", version: 7`. Versions 1–6 and unknown future
versions are rejected before replacing work. There is no compatibility reader or
model-dependent version selection. Requests, original snapshots and acknowledgments
remain v1. The file extension stays `.trksess`.

The root contains a validated analysis: `request`, `settings`, matching `engine`,
optional `originalRequest`, and optional `dataTable`. The source table is required
for multi-fit workspaces, and preserves exact cell text, unused columns, row IDs,
optional row-label assignment, headings, analysis-column assignments and
case-sensitive units. Numeric-only single fits can reconstruct their displayed
table from the preserved request.

Every session requires `workspace` and `view`. `workspace.kind` identifies what to
open:

- `single-fit`: use the root equation, parameter values/fixed flags, exclusions,
  units and uncertainty assumptions. All built-in and custom equations use the
  same settings schema and file version.
- `multi-interval`: X/Y assignments, uncertainty mode and retained common sigmas,
  assumption acceptance, interval names/ranges, and each series' settings. Hidden
  interval slots are retained; active interval and series indices restore the
  selected controls.
- `model-comparison`: two to six labeled candidates and the active candidate.
  Each candidate contains a validated analysis, using the same request/settings/
  engine/source fields as the root. It has no separate format, version or nested
  workspace. Compatibility for statistical comparison is checked when fitting.
- `collision`: time/four position assignments, separated before/after windows,
  uncertainty mode/values and detail visibility.

`view` preserves residual, guide and error-bar visibility for every analysis.
Interval/collision workspaces also retain shared X limits, per-graph Y limits and
print-detail preferences. Appearance, single-fit graph mode/axis limits, output
size, undo history, editor drafts and computed results are not serialized. Fits
are recalculated explicitly after opening; saved starts are not re-suggested.

The shared settings schema validates model-specific coefficient counts, positive
widths/time constants, fixed flags and custom-expression grammar, names and
units. Engines identify the current solver: `qr-vp-sine-2` for basis models,
`qr-lm-3` for nonlinear built-ins, and `qr-expression-4` for custom equations.
Adding an equation does not select another session format.

Validate every request and original snapshot, retained uncertainty map, exclusion
identity, source-table association and nested candidate. Workspace validation also
checks available/distinct columns, finite increasing ranges, positive sigmas,
per-series settings/range counts and existing active indices. Collision windows
must be separated. Incomplete numeric or equation drafts block saving.

Open through **Data… → Load file**, then **Use these data**. Applying a session
restores its saved analysis type and setup. Importing observations (CSV or request
JSON) keeps the current workspace. Canceling review or keeping unsaved changes
leaves current work intact. Candidate-specific file controls accept single-fit
v7 sessions; other workspace files belong in the main loader.

### Conversion of bundled examples

All 40 checked-in `.trksess` examples were converted together. For former single
fits, conversion sets version 7, adds `workspace: {kind: "single-fit"}`, and sets
view defaults to residuals/error bars on and guides off. Existing multi-fit
workspace and view objects are preserved. Candidate analyses use unversioned
analysis objects. The former `qr-mgs2-1` label is updated to the current basis
solver identifier; equations, parameter meanings and numerical algorithms are
unchanged. The nonlinear/custom protocol examples now have filenames without
obsolete version suffixes.

Before conversion, every file was validated and its inputs and available fit
results recorded. After conversion, requests, originals, exact source tables,
settings and saved workspace/view fields were compared in full, and single-fit
coefficients, objective, sample size, rank and degrees of freedom reproduced
exactly. Original data CSV files were not rewritten. Cavendish retains both damped
fits using elapsed seconds.

Unconverted personal v1–v6 sessions do not open in this build; keep their originals
for explicit offline conversion using the field mapping above. Never relabel an
unknown version on import or silently discard its fields. Future incompatible
structure changes require another documented migration; only one current session
format should remain in the application.
