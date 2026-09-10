# Fit interchange schemas (v1 and session v2)

Generate these files with `npm run schemas:fit`. They are generated from the strict Zod 4 schemas in `src/core/fit/schema.ts` using the Zod 4 entrypoint already included in the installed Zod package. Ajv is a development-only independent validator; no numerical runtime dependency was added. Format UUID checks are enforced by Zod; external validators should enable format validation.

These draft-07 schemas define request, session and acknowledgment structures. They are ready for review, not a promise of upstream Tracker compatibility. Examples and intentionally invalid examples are in `examples/fit/`.

JSON Schema alone does not express every cross-row invariant. After structural validation, adapters MUST also check:

- Row IDs and exclusion IDs are unique; exclusions refer to existing rows.
- Missing x/y requires a non-null reason and an excluded source row. Complete rows require a null reason.
- Included source rows have supplied per-row uncertainties; uncertainty entries refer to existing rows.
- Known correlation cannot coexist with asserted independent Gaussian errors.
- Model parameter count is two for line/logarithmic, three for quadratic/constant acceleration/sine, four for cubic and five for quartic. Optional sinePeriod must be finite and positive; absent means 2π in the declared x-unit.
- Values remain finite in the target binary64 representation, including JSON numbers that overflow a parser.

The application runs the same semantic validation after file import, before save and before solving. Requests contain snapshot inputs; sessions contain requests and editable analysis settings, without cached results. The engine version makes the currently selected numerical implementation explicit. Import of unknown engine versions is rejected in this preview.

CLI file delivery and correlated acknowledgments are implemented and tested; see [integration](../docs/integration.md). The original Tracker adapter remains a separate project. Data Tool opens as an independent application.

Draft v1 extension: cubic, quartic, logarithmic and sine model identifiers and optional sinePeriod were added on 2026-09-07. Existing v1 files remain valid without migration; older applications reject these new models and fields rather than silently interpreting them. The request format is unchanged. The QR engine identifier remains qr-mgs2-1 because the factorization and inference algorithms are unchanged. Natural log uses ln(x/xref), with xref exactly one declared x-unit; selected x must be positive. Sine uses a supplied period, with coefficient order b, s, c for b+s*sin(2πx/T)+c*cos(2πx/T). Uncertainty excludes uncertainty in the supplied period.

Further draft v1 extension: sine-free-period (b, s, c, T), exponential (b, a), power-law (b, a), reciprocal (b, a). Required positive ordered periodMin/periodMax specify the sine search interval; T's parameter value must be positive, and its fixed flag bypasses the search. The optional finite shape setting is the exponential rate k (default −1, inverse x-unit) or power exponent p (default 2, dimensionless). Power and reciprocal use positive x normalized by one declared x-unit. New sessions use engine qr-vp-sine-2; old qr-mgs2-1 sessions still load without migration. Fitted-period sine requires the new engine identifier. Older apps reject the new identifiers and fields. No derived outputs are serialized.

Session settings may now include retainedPerRowUncertainty: the original strict supplied-per-row uncertainty object (values, correlation structure and provenance). This optional canonical input preserves per-point uncertainties when a different noise model is active. Validate it against the current request's row identities, required uncertainties and assumption consistency just as for active uncertainty. It is retained through model changes and session round trips, but never transferred to a newly loaded dataset. Existing sessions still load without migration; older readers reject the new field explicitly. This does not change the numerical engine.

Draft-v1 minor-edit extension: sessions optionally contain `originalRequest`, validated with the same complete request schema. It preserves the input before the first change; current request and original snapshot can have different rows, labels, uncertainty values and IDs after edits. Missing field is valid for older sessions. Older strict readers reject the extension rather than discard the original data. Undo history and fit results remain outside the saved format. Delimited imports preserve all mapped records; invalid numeric tokens block import, while empty x/y cells receive a missing reason and remain excluded.

Draft-v1 unified Data extension: sessions optionally include `dataTable` with source `cells`, parallel stable `rowIds` (including headings), `headerRows`, zero-based `x`/`y`/nullable `sigma` assignments, and per-column `units`. Unused source columns and headings remain editable. Structural validation is strict. Semantic validation requires the mapped table rows and units to match the current request, distinct mapped columns, unique row IDs, and supplied/retained per-row uncertainties to agree with the selected sigma column. Older sessions reconstruct a table from their analysis inputs; older strict readers reject the new optional field. Fit results and temporary table undo history remain derived/runtime state.

Draft v1 source metadata extension (2026-09-09): request.source may include `fileName`, a nonempty string or null. It records a known source basename independently of editable dataset labels and comments; null explicitly denotes data without a source file, such as a new pasted table. Legacy omission remains valid. On opening legacy JSON/session files, the app may record the supplied basename when the field is absent; it preserves explicit null and existing names. Session round trips retain the field, including inside originalRequest. Older strict readers reject this added field. This does not change the numerical engine.

## Nonlinear session v2

`tracker-fit-session.v2.json` adds five model IDs and uses engine `qr-lm-3`. The v1 schema is unchanged. New builds parse both session schemas; the request and acknowledgment formats remain v1. See [migration and save behavior](../docs/integration.md#session-v2-for-nonlinear-models--2026-09-09).

In addition to the existing semantic checks, enforce parameter counts and domains: exponential-decay `[b,A,tau]` requires tau > 0; power-law-free `[b,A,n]` requires positive included x; gaussian `[b,A,mu,sigma]` requires sigma > 0; damped-sine `[b,s,c,T,tau]` requires T > 0 and tau > 0; lorentzian `[b,A,mu,gamma]` requires gamma > 0. Parameter names are documented labels; the file stores parameters in that order. Fixed/free flags retain their existing meaning. No new optional settings fields or snapshot fields are introduced.

`npm run schemas:fit -- --schemas-only` regenerates just the structural schema files. Omitting that flag also regenerates the historical synthetic fixtures. Generators are development-only; none are imported by production code.

## Custom equation session v3

`tracker-fit-session.v3.json` adds `custom` settings and engine `qr-expression-4`. Enforce the restricted expression grammar, identifier and complexity limits, exact first-occurrence parameter order, matching parameter/name/unit lengths (1–8), and valid non-reserved independent variable. `custom` metadata is required for the custom model and forbidden on built-in models. Units are case-sensitive strings, with blank meaning unknown. Built-in settings still undergo their original count/domain checks. Requests and acknowledgments remain v1. See [v3 migration](../docs/integration.md#session-v3-for-custom-equations--2026-09-10).
