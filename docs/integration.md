# Tracker ↔ Data Tool integration

Data Tool 2027 is a separate desktop process. Tracker owns video decoding, calibration and digitization; Data Tool receives an immutable numerical snapshot. No Java classes, shared UI, decoder or network service crosses the boundary.

## Stable v1 files

Continue using the published strict schemas in `schemas/`:

- `tracker-fit-request.v1.json`: one numerical dataset, explicit units and uncertainty/provenance.
- `tracker-fit-session.v1.json`: request plus fit settings, source table and original snapshot when present. Existing `.trksess` files remain readable and savable.
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

`npm run test:integration` launches the actual release app with a request, a legacy session and an invalid request, checks accepted/error acknowledgment files and request IDs, then terminates only the test-owned processes. There are no production smoke commands or environment-controlled test data paths. Windows/Linux portability is an architectural target; only macOS binaries have been built here.

## Session v2 for nonlinear models — 2026-09-09

The new `exponential-decay`, `power-law-free`, `gaussian`, `damped-sine` and `lorentzian` model identifiers are saved with `format: "tracker-fit-session"`, `version: 2`, and engine `qr-lm-3`. Their structural schema is `schemas/tracker-fit-session.v2.json`. This is an explicit version boundary: the published v1 session schema and its model identifiers remain unchanged.

The `.trksess` filename extension is retained for both session versions. New Data Tool builds read both versions. Existing models still save as v1 with `qr-vp-sine-2`; selecting a new model saves as v2. Returning to a legacy model permits saving as v1 because its settings again fit that schema. No new-model session is silently rewritten as a v1 approximation. Older readers must reject v2 rather than reinterpret it; export CSV if only the observations are needed by an older application.

Request snapshots, original requests and acknowledgment envelopes remain v1. A v2 session embeds a v1 numerical request, preserves the same source-table validation, and records starting/fixed parameters without cached optimization results. The CLI accepts v2 sessions and emits the same correlated v1 accepted/error acknowledgment after validation. Unknown session versions and engine identifiers are rejected. The release integration test now also launches a v2 Gaussian session.

See [nonlinear model equations and numerical limitations](nonlinear-fits.md).

## Session v3 for custom equations — 2026-09-10

Custom equations save as `tracker-fit-session`, version `3`, engine `qr-expression-4`, retaining `.trksess`. The strict structural schema is `schemas/tracker-fit-session.v3.json`. `settings.model` is `custom`; `settings.custom` records `expression`, `variable`, ordered `names`, and parallel `units`. `parameters` contains 1–8 finite starting values and fixed flags in that same order. Names must exactly match first occurrence in the parsed expression excluding the independent variable and reserved constants; unit entries may be blank (unknown). Apply the parser limits and syntax validation in [custom equations](custom-equations.md), in addition to all existing session semantic checks.

The published v1 and v2 structures are unchanged. New builds accept all three session versions. Legacy models still save as v1, the five nonlinear built-ins as v2, and custom equations as v3. Older applications must reject v3 rather than discard the equation. Selecting a built-in again permits saving in its older format. Requests, original snapshots and acknowledgments remain v1; source tables and uncertainty assumptions retain their existing validation. Tracker and OSP code remain untouched.

The multi-interval UI is a separate in-memory draft. It does not add fields to any existing session version or change Tracker request/ack compatibility. Multi-interval session saving remains disabled pending an explicit schema migration; source tables and single-fit sessions remain savable as before. See [multi-interval scope](multi-interval.md).
