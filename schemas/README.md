# Fit interchange schemas: request/ack v1, session v7

`tracker-fit-session.v7.json` is the only supported session schema. It covers
single fits, multi-interval fits, model comparison and collision analysis. All
models share one settings schema; file versions do not depend on the equation.
The pre-beta migration replaces session v1–v6; see the [field contract and conversion](../docs/integration.md#one-session-format-v7--pre-beta-migration-2026-09-15).

Generate schemas with `npm run schemas:fit -- --schemas-only`. Omitting the flag
also regenerates the synthetic protocol fixtures in the current format. These
strict draft-07 schemas come from Zod in `src/core/fit/schema.ts`; Ajv independently
validates the examples. External validators should enable UUID format validation.
Generators are development tools, never production imports.

JSON Schema checks structure. The application also validates these semantic rules
on import, before saving, and for numerical analysis before fitting:

- Unique row and exclusion identities; exclusions and uncertainty maps reference
  existing rows. Included rows have all required supplied uncertainties.
- Missing X/Y values have a missing reason and cannot be included; complete rows
  have a null reason. All numerical inputs remain finite in binary64.
- Known correlation cannot coexist with asserted independent Gaussian errors.
- Model-specific parameter counts, positive widths/time constants and valid
  ordered period bounds. The engine must match the model.
- Custom expressions use the restricted grammar, exact first-occurrence parameter
  order and matching names/units/parameters (1–8). Custom metadata is forbidden
  for built-ins. Polynomial degree N requires N+1 coefficients (up to 11).
- Optional retained per-row uncertainties are validated against the current
  request just as active uncertainties are. Original snapshots are independently
  validated and can retain earlier row sets and assumptions.
- Source table rows, numbers, units and selected sigma column agree with the
  current analysis. Preserve exact cell text and unused columns.
- Every workspace has a kind and every file has view preferences. Multi-fit
  workspaces require a source table. Candidate analyses have no file envelope or
  nested workspace, and undergo the full analysis validation.
- Workspace columns are distinct and available, with numeric or missing values.
  Each series has settings and uncertainty/display-range entries. Supplied sigmas
  are positive, intervals are finite and increasing, collision windows are
  separated, and active indices refer to available controls.

Sessions store editable inputs, not results or undo history. Single-fit, interval,
comparison and collision setup are restored explicitly; no fit runs on opening.
Requests and acknowledgments remain unchanged v1. Their protocol identifiers are
not a promise of upstream Tracker compatibility; the adapter is a separate
project. CLI acceptance means validated and staged for review, not fitted.
