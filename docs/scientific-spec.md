# Scientific contract inherited from the fitting companion

This document preserves the fitting specification used during development inside Tracker. Product identity and process integration now follow Data Tool 2027; see [integration.md](integration.md). Historical implementation sequencing does not imply that Tracker UI or video code belongs in this repository.

# Tracker companion fitting window — specification 0.4

Status: review draft 0.4, 2026-09-07. Merges the 0.3 external review into 0.2 while retaining its scientific and failure-handling requirements. Draft JSON Schemas are now published separately in `schemas/` with structural and semantic validation tests; this document does not inline them. This is the review target for the new application and adapter. A standalone preview and draft JSON Schemas are now implemented; see [implementation status](fit-window-build.md). The original Tracker adapter remains unimplemented. Review the scientific contracts and workflow before selecting numerical dependencies or writing the UI. MUST denotes an acceptance requirement; SHOULD denotes a design preference.

## 1. Product objective and scope

Keep original Tracker's mature video handling, calibration and digitizing workflow. Add an optional **Open in Fit Window** action that sends selected numerical data to a separate local application. The companion MUST also open its interchange files independently of Tracker. No video engine, video transfer, network service or telemetry is required.

First release: one selected x/y dataset per analysis, models linear in their coefficients, fixed/free parameters, explicit uncertainty choices, residual inspection, reproducible reports and session save/reopen. Support several independent analysis windows without mixing their inputs. Initial delivery targets macOS; the protocol and scientific core MUST remain portable to Windows and Linux. Packaging on those platforms requires separate verification.

Initial models:

| Model identifier        | Equation               | Parameter order |
| ----------------------- | ---------------------- | --------------- |
| `line`                  | y = b + m*x            | b, m            |
| `quadratic`             | y = c0 + c1*x + c2*x²  | c0, c1, c2      |
| `constant-acceleration` | y = y0 + v0*t + a*t²/2 | y0, v0, a       |

The last model uses the selected x column as t. The user MUST confirm that this column represents physical time; no conversion from video frame rate is inferred. Units come from explicit metadata. Absent units remain unspecified. Generic unit symbols are supported without guessing their conversion factors. Parameter units follow the model basis: y units, y/x units and y/x² units.

Nonlinear expressions, bounds, robust fitting, correlated-error solvers, x-error solvers, global/shared-parameter fitting and automatic model selection are later scope. The architecture SHOULD permit them through explicit model and solver contracts.

## 2. User workflow

1. Select columns and observations in Tracker, then open the companion.
2. Inspect the data, included count, source identity, units and uncertainty assumptions.
3. Choose a model and fix any parameters whose values are being asserted.
4. Fit and inspect the curve, residuals, parameter errors and available statistics.
5. Change the model, range, exclusions or assumptions and compare the resulting analysis.
6. Copy results or save a self-contained analysis session.

The data plot, equation and parameter table MUST remain visible together at the normal desktop window size. An aligned residual plot MUST sit below the data plot with the same numerical x scale. Horizontal panning and zooming in either plot MUST update both views together. Report expansion MUST NOT repeatedly change plot height. Plots MUST use actual numerical coordinates and show units, zero reference for residuals, and excluded observations distinctly.

Range selection and individual exclusion MUST preserve input values and stable row identities. Exclusion is reversible and visible; no automatic outlier removal is permitted. Preserve original row order in the snapshot. Sorting for plotting is a derived view and MUST preserve associations with uncertainties and exclusions.

Parameter rows show name, value, unit, fixed/free state, standard error and interval when available. Standard errors and confidence intervals MUST have different labels. Manual changes produce a manual preview or stale result, never an apparently current optimized report. An explicit Fit action is required in the first release. A cancelled, failed or superseded computation cannot overwrite a newer result.

The UI MUST support keyboard access, readable resizing and undo for analysis-setting changes. Invalid input retains the previous session and displays a specific error. Copying rounded display text and full-precision numeric data MUST be distinct actions. A visible discard choice is required before replacing unsaved analysis work.

## 3. Canonical analysis inputs

The fitting application receives an immutable numerical snapshot, not authority over Tracker's measurements. Its fit-session format is separate from `.trk27` and existing Tracker project formats. Calibrated or differentiated values may be stored as labeled analysis inputs; they MUST NOT be presented as newly measured raw positions.

Input contract:

- A protocol version, request UUID and snapshot UUID; these are identities, not revision counters.
- Dataset identity and label; independent/dependent column identities, labels and nullable unit symbols.
- Source application/version and available project, track, calibration and timestamp provenance. Unknown provenance is explicitly unknown.
- Rows with unique stable row IDs, x and y values, initial inclusion state and missing-value reasons where relevant.
- Declared uncertainty model and error assumptions, with provenance for supplied uncertainties.

All numeric values MUST be finite IEEE-754 binary64 values. JSON cannot carry NaN or Infinity. Missing x/y use `null` and a reason. Such rows remain visible as unavailable and cannot be included until valid data are supplied. Never collapse repeated x values or align datasets by rounded values. Repeated x values are legitimate replicates; rank determines whether they suffice for a model.

Uncertainty is a strict tagged union:

| Kind               | Required content                            | Interpretation                                                           |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------ |
| `unknown-equal`    | none                                        | Equal weights; common variance estimated from residuals                  |
| `supplied-common`  | finite sigmaY > 0 and provenance            | A common absolute measurement standard deviation                         |
| `supplied-per-row` | row-ID-to-sigmaY association and provenance | Absolute standard deviations, positive and finite for every included row |

Provenance distinguishes an asserted assumption from an externally established uncertainty. Unknown uncertainty MUST NOT silently become 1 px or another numerical default. Partly missing supplied uncertainty is an error until the user explicitly changes inclusion or uncertainty mode. Invalid supplied values MUST NOT fall back to estimated scatter.

The uncertainty object MUST also contain `errorStructure: "uncorrelated" | "known-correlated" | "unknown"`. This flag records declared correlation structure; `uncorrelated` alone does not establish independent Gaussian errors. Separate assumption fields MUST record the status of treating x as exact, independent Gaussian y errors, and the physical model/fixed constraints. Each status is `asserted`, `unknown` or `known-false`; assertions retain provenance. Contradictory declarations, such as known correlation plus asserted independence, are validation errors.

Known correlated errors, declared non-negligible x errors, or known-false inference assumptions require descriptive-only mode in v1. Point estimates, residuals and the chosen least-squares objective remain available; inferential errors, intervals and Q are unavailable. In particular, the weighted residual sum remains computable with supplied marginal uncertainties, but MUST be labeled “weighted residual sum” rather than interpreted as a chi-square-distributed goodness-of-fit statistic. Its division by nu may be shown only as a descriptive weighted objective per residual degree of freedom.

For unknown assumptions, the default is descriptive-only. The user may explicitly enable conditional inference by accepting the independent Gaussian y-error, exact-x and correct-model/fixed-value assumptions for this analysis. Record that acceptance without changing the source metadata from unknown to verified. Display “conditional on stated assumptions” with the report. The application cannot establish these assumptions merely by obtaining a successful fit.

Velocity/acceleration from overlapping difference stencils may have correlated errors. Marginal error bars do not establish independence. A pixel uncertainty cannot be applied directly to an arbitrary derived column; the host must supply a justified conversion and provenance, or conversion is unavailable.

## 4. Numerical contract

Let the model be y = A*beta. Subtract the fixed-parameter contribution to form the response for the remaining free columns. Let n be the included valid row count, p the free coefficient count, r the numerical rank of the weighted free design, and nu = n-r. For supplied errors, evaluate numerical rank on the whitened design W^(1/2)*A_free; for equal weights, use A_free. Report how internal column scaling enters the numerical rank decision. Positive weights preserve exact rank but may materially change numerical conditioning.

For unknown equal uncertainty, minimize SSE = sum(e_i²). For supplied absolute uncertainty, minimize chi² = sum((e_i/sigma_i)²), where e_i = y_i - f(x_i). Treat x as exact in these objectives.

Use a documented rank-revealing QR or SVD algorithm. Do not compute the solution by explicitly inverting normal equations. Column scaling/centering is permitted, but transform all coefficients, fixed constraints and covariance back into the declared physical parameter basis. Record solver version, scaling procedure, rank threshold and conditioning diagnostics. Choose and document the threshold before approving numerical fixtures; no fixture-specific adjustment.

For a full-rank fit, the following formulas specify the result mathematically, not an instruction to perform matrix inversion:

- Known absolute uncertainties: C = (A_free^T W A_free)^-1, W_ii = 1/sigma_i².
- Unknown common variance, nu > 0: s² = SSE/nu and C = s² (A_free^T A_free)^-1.
- Free-parameter standard error: sqrt(C_jj). Fixed parameters have unavailable estimated errors, with reason `fixed`.
- Known-sigma marginal 95% interval: beta_j ± z_0.975*sqrt(C_jj).
- Estimated-sigma marginal 95% interval: beta_j ± t_(nu,0.975)*sqrt(C_jj).

These are individual parameter intervals, not simultaneous intervals or prediction bands. Their stated coverage assumes the correct linear model, the stated Gaussian error model, correct fixed values, and selection not chosen in response to residuals. If a user excludes points after inspecting them, the report MUST retain that selection history and disclose that nominal coverage does not account for selection.

Rank deficiency MUST be an explicit result. Do not present a unique set of free coefficients or ordinary parameter intervals when r < p. Report rank and the identifiability failure; a minimum-norm diagnostic solution, if implemented later, needs a separate label.

If n = 0, fitting is unavailable. If all parameters are fixed, evaluate residuals without optimization; r = 0 and no coefficient uncertainty is estimated. If nu = 0, residual-estimated variance and reduced chi-square are unavailable. A full-rank known-sigma fit may still have parameter covariance with nu = 0, but no residual goodness-of-fit probability. Negative degrees of freedom must not arise from the rank definition.

## 5. Statistics and failure semantics

| Quantity                   | Definition / availability                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SSE                        | sum(e_i²), for included rows                                                                                                   |
| RMS residual               | sqrt(SSE/n), n > 0                                                                                                             |
| Estimated residual scatter | sqrt(SSE/nu), unknown-equal mode and nu > 0                                                                                    |
| chi-square                 | sum((e_i/sigma_i)²), supplied uncertainty only                                                                                 |
| Reduced chi-square         | chi²/nu, supplied uncertainty and nu > 0                                                                                       |
| Goodness-of-fit Q          | upper-tail chi-square probability with nu degrees of freedom, supplied uncertainty, nu > 0 and supported inference assumptions |
| Centered R²                | 1-SSE/sum((y_i-mean(y))²), nonzero denominator; unweighted descriptive statistic even for a weighted fit                       |

Q is not the probability that the model is true. No Q is reported when the same residuals were used to estimate the noise scale. Supplied absolute errors MUST NOT be rescaled to force reduced chi-square to one. Centered R² remains available with a fixed intercept whenever its denominator is nonzero: fixing the intercept does not make this descriptive statistic undefined. R² can be negative and is not proof of model adequacy. Adjusted R² and ANOVA are deferred.

For an exactly zero SSE in unknown-equal mode with positive nu, report zero residual scatter but flag `zero-residual-scale`; suppress inferential parameter errors and intervals rather than claim experimentally established perfect precision. Known supplied uncertainties still give nonzero covariance where appropriate. Never evaluate 0/0 or hide an undefined quantity as zero.

Report raw residuals for each included row. With supplied errors, optionally show e_i/sigma_i, labeled normalized residuals: these are not independent standard-normal samples after fitting because leverage and fitted parameters affect their distribution.

Unavailable statistics MUST carry a machine-readable reason and a human-readable explanation. Numerical overflow, invalid design evaluation, excessive conditioning and solver failure MUST be distinguishable from a successful fit. A successful solve is not evidence that the scientific assumptions hold.

## 6. Synthetic-data validation with known scatter

Synthetic validation MUST test the distribution of results across independent generated experiments, not demand that each noisy fit recover the exact truth. The test harness knows the true parameters and generating noise; the fitter receives only the same inputs an experimenter would supply.

Use a specified, versioned pseudorandom generator and Gaussian transform with fixed seed lists and independent substreams per experiment. Commit small generated fixtures and their generation metadata as a check against generator changes. Do not tune seeds or tolerances after observing a regression failure. Tests of the production probability functions MUST use independent reference quantiles, not their own output as the oracle.

### 6.1 Baseline experiments

Use M = 10,000 independent repetitions per scenario in the full scientific validation suite. A smaller deterministic subset may run during development, but cannot replace the release suite.

For n = 61, use either t_i = 2*i/60 or the irregular design t_i = 2*(i/60)^1.3, i = 0,...,60. Ground truth is y(t) = 2 + 10*t - 9.81*t²/2. Generate y_i = y(t_i) + sigma_i*z_i with independent z_i ~ N(0,1).

Required scenarios:

1. Constant sigma_i = 0.02 m, supplied-common mode, uniform times.
2. The same generation with unknown-equal fitting; sigma is withheld from the fitter.
3. Per-row sigma_i = 0.01 + 0.02*(t_i/2) m, supplied-per-row mode, irregular times.
4. Common known sigma, irregular times, y0 fixed at its true value.
5. Common unknown sigma, irregular times, y0 fixed at its true value.
6. A small-sample line fit with n = 8, x_i = i/7, y = 1 + 2*x, sigma = 0.1, unknown-equal mode. This distinguishes Student-t intervals from incorrect normal intervals.

### 6.2 Statistical acceptance gates

Register all primary statistical gates in a manifest before running the suite. Use a family-wise false-failure budget alpha = 0.001; with K primary gates, allocate alpha/K to each gate by Bonferroni. Reference distributions and quantiles must be generated independently and checked in with provenance. Fixed seeds make runs reproducible but do not remove Monte Carlo sampling uncertainty.

For each baseline scenario and free parameter:

- **Bias:** compare the mean fitted coefficient to truth using its independently calculated Monte Carlo standard error sqrt(C_true,jj/M) and the registered two-sided normal limit. C_true uses the generating covariance, not a fitted residual scale.
- **Spread:** compare empirical coefficient variance to C_true,jj using the chi-square sampling distribution with M-1 degrees of freedom. Preserve parameter correlations in the reference covariance; do not treat the coefficients within an experiment as independent repetitions.
- **Reported covariance:** known-sigma output must match the independent covariance numerically for every repetition. For unknown sigma, compare mean reported covariance against C_true; average s²/sigma² has a chi-square-based reference with M*nu degrees of freedom in the equal-noise, fixed-design baselines.
- **Coverage:** count truth inside the reported marginal 95% interval. Accept only counts within preregistered exact binomial acceptance limits for M trials and p = 0.95. Approximate ±0.43 percentage points is a single-comparison 95% sampling margin at M = 10,000, not the suite's multiplicity-adjusted gate.

For each known-sigma baseline, sum chi² over repetitions and compare to the chi-square distribution with M*nu degrees of freedom. If testing the mean instead, divide both acceptance bounds by M; its expected value is nu. Check the count of Q < 0.05 against exact binomial limits with p = 0.05. Also publish a Q histogram as a diagnostic, without unregistered pass/fail gates. Unknown-sigma baselines MUST return unavailable Q in every repetition.

A statistical failure is investigated against the frozen fixture/seed manifest. Do not rerun with new seeds until it passes. Report failed gates and Monte Carlo uncertainty alongside numerical failures.

### 6.3 Deliberately violated assumptions

These tests establish predictable limitations; they MUST NOT require valid nominal 95% coverage when assumptions are false.

- **Incorrect supplied scale:** use the same common-noise data with supplied sigma multiplied by 0.5 and 2. Coefficients MUST remain unchanged; standard errors scale by that factor; chi² scales by its inverse square. Coverage changes in the expected direction across the ensemble.
- **Wrong model:** fit a line to quadratic data with known sigma. Determine expected excess objective from the noise-free signal's projection residual: noncentrality lambda = sum((model-mismatch_i/sigma_i)²). Validate ensemble objective against an independently computed noncentral chi-square reference; do not demand that every trial rejects the model.
- **Correlation:** generate stationary Gaussian AR(1) noise with rho = 0.7, initial error N(0,sigma²) and innovations of standard deviation sigma*sqrt(1-rho²). Compare empirical estimator covariance to the independent sandwich expression B*Sigma*B^T, where B is the actual linear estimator. Demonstrate the mismatch with an independence-based covariance; if correlation is declared to the product, assert descriptive-only behavior.
- **Outliers:** add a fixed 8-sigma offset to a specified interior row. Show its residual and effect on the fit; verify no automatic deletion. No universal detection or coverage guarantee is asserted.
- **Incorrect fixed coefficient:** fix y0 at an incorrect value. Verify it stays fixed and test the expected projected bias in remaining coefficients; do not report unbiased recovery.

## 7. Deterministic scientific and software tests

- Analytic noise-free line/quadratic cases, both time designs and every fixed/free combination.
- Independently computed weighted solutions, covariance, normal/t/chi-square functions and tail probabilities; include extreme tails and declared absolute/relative tolerances.
- Relevant NIST certified linear-regression fixtures. Select representable models explicitly; passing a few fixtures is not evidence for unsupported polynomial degrees.
- Duplicate x values, rank deficiency, near rank deficiency, zero/one point, n = p, all-fixed models, zero residuals, constant y and invalid uncertainties.
- Row permutation, exclusions, translation/scaling of x and unit conversion. Verify transformed parameters and full covariance, not just the fitted curve. Fixed-parameter meaning must survive internal basis changes.
- JSON round trips, precision preservation, malformed/unsupported schemas, row association and unavailable-value reasons.
- Async cancellation, stale result rejection, failed import/save, independent simultaneous sessions and preservation of unsaved work.

Every numerical assertion MUST use an explicit scale-aware absolute/relative tolerance justified by conditioning and reference precision. Ordinary well-conditioned analytic fixtures SHOULD meet relative error 1e-10 with a documented absolute floor; ill-conditioned cases require their own stated expectations. Never loosen all tolerances to accommodate one failure.

## 8. Tracker adapter and local interchange

Proposed desktop action: **Open in Fit Window** alongside the existing Data Tool. Local inspection found `TrackPlottingPanel.showDataTool()` already assembles plot datasets and selects working columns. This is a candidate adapter location, not an existing external plugin API.

Use a separately launched executable and a UTF-8 JSON request file. Java's ProcessBuilder can launch another-language process. Each argument is passed separately; do not construct a shell command containing paths or labels. Launch and file I/O MUST avoid blocking Swing's event thread. This is a separate top-level window, not foreign controls embedded in Swing.

Protocol envelope: `format: "tracker-fit-request"`, `version: 1`, `requestId`, `snapshotId`, `source`, `dataset`, and `uncertainty`. Nested object schemas MUST reject unknown fields. The implementation must publish complete JSON Schemas, an example request and invalid fixtures before adapter work begins. Core validation MUST be identical for standalone imports and Tracker requests.

Dataset contains the column metadata, assumption declarations and rows specified above. Default model selection belongs to analysis settings, not data provenance. No expressions supplied by the host are executed. A request UUID identifies a delivery; a snapshot UUID identifies immutable content and must never be reused for changed content. The snapshot UUID is an identity, not a content hash. Content hashing is deferred in v1; do not call the UUID “content-hashed.” A future integrity digest needs a distinct field, algorithm and exact byte/canonicalization contract. No internal revision integer is required.

The companion MUST read and validate the request into owned state and write a versioned acknowledgment containing requestId and accepted/error status. Use the platform temporary-directory API, not a hard-coded `/tmp` path. Create a unique private request directory, write complete files before exposing them, and validate acknowledgment version and request identity before accepting it. The adapter owns the temporary request until acknowledgment; it may then remove its files. A timeout produces a recoverable message, never termination of Tracker. Exact executable discovery, acknowledgment path and timeout are platform-adapter decisions documented and tested before shipping. The companion must not need the temporary file after acknowledgment.

Opening a request produces a snapshot. Source edits in Tracker do not silently update it; explicit resend creates another snapshot. Live synchronization and automatic result return to Tracker are deferred. No analysis result overwrites measured data. Missing companion, unsupported versions, malformed input and launch failure retain Tracker's current work.

Fit sessions use `format: "tracker-fit-session"`, `version: 1` and contain the input snapshot, exclusions/history relevant to inference, model ID, parameter constraints, uncertainty settings, assumptions and solver configuration. Optional computed results include engine version and are marked stale/recomputed if compatibility cannot be established. Exports include the exact model equation, parameter order, residual convention, covariance/interval method, units, rank, degrees of freedom and unavailable reasons. No video bytes or session blob URLs are stored.

## 9. Implementation organization and delivery gates

Keep the scientific core as pure TypeScript independent of React, DOM, storage and native process APIs. Desktop integration may reuse the existing shell; protocol data must not depend on the UI language. Runtime numerical dependencies require a documented accuracy, license, size and maintenance assessment. Test-only reference generators can use independent tooling.

Deliver in this order:

1. Review this document and resolve scientific questions; publish strict interchange/session schemas and representative files.
2. Implement and independently validate the numerical core, deterministic fixtures and full synthetic suite.
3. Build a window using synthetic/imported files; review selection, parameter editing, residuals and report copying with the experimenter.
4. Add the small Tracker adapter after the standalone workflow is useful. Sibling reference repositories remain read-only in this workspace; adapter changes require an authorized writable checkout.
5. Verify the real Mac launch/file exchange and failure paths; document what remains untested on Windows/Linux.

Completion requires green scientific tests, schema/round-trip tests and interface tests, plus hands-on acceptance. Test counts alone do not establish usability or universal correctness.

## 10. Relationship to PR9 and references

The inspected local OSP `test/fit-report-physics.md` documents the PR9-related distinctions between externally supplied uncertainty and residual-estimated scatter, limitations on Q, and profile/refit curvature errors. Preserve those distinctions. This first-release specification deliberately chooses exact linear-model covariance, and MUST NOT label it as PR9's profile algorithm. No claim is made about upstream PR merge status.

Primary references for implementation review:

- [NIST least-squares overview](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm) defines the least-squares objective and residual-scale estimation.
- [NIST certified linear-regression datasets](https://www.nist.gov/itl/sed/statistical-reference-datasets/strd-background-information/linear-regression) provide independent numerical benchmarks.
- [Java ProcessBuilder](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ProcessBuilder.html) documents launching external processes.

The Monte Carlo scenarios, budgets and product requirements above are proposed acceptance criteria, not claims that a cited source specifies this application. Implementation review must independently verify the distributional derivations and probability-function references.

## 11. Questions for independent review

1. Are the known-sigma versus estimated-sigma covariance and interval rules correct, including fixed parameters, zero residuals and zero degrees of freedom?
2. Do the ensemble tests distinguish biased coefficients, miscalibrated standard errors and incorrect coverage without relying on the production solver as its own oracle?
3. Are the Monte Carlo gate distributions and multiple-comparison budget sufficient and implementable?
4. Are missing data, repeated x values, exclusions and uncertainty associations unambiguous?
5. Does the specification adequately distinguish raw measurements from derived analysis snapshots and preserve PR9's scientific intent?
6. Are linear/quadratic models enough for the first useful release, or is a particular nonlinear physical model essential?
7. Does the proposed window reduce the actual fitting friction, and what concrete interaction is still missing?
8. Is file-based snapshot exchange an adequate first integration with desktop Tracker?

Please identify mathematical errors, contradictory requirements and missing acceptance conditions before recommending additional scope. Separate required corrections from optional enhancements. Do not assume implementation or statistical validation has already occurred.

## 12. Changes reconciled from review 0.3

- Adopted synchronized horizontal plot navigation and an explicit error-structure flag.
- Added an explicit opt-in policy for conditional inference when assumptions are unknown; known violations remain descriptive-only.
- Retained centered R² for fixed-intercept models; only its zero-variance denominator makes that descriptive definition unavailable.
- Distinguished a weighted objective from a chi-square distribution claim and from the probability Q.
- Made weighted numerical rank and the sum-versus-mean Monte Carlo gate explicit.
- Kept reported-covariance checks, independent reference distributions, frozen seeds, outlier and incorrect-fixed-value tests, and failure/unsaved-work safeguards from 0.2.
- Separated snapshot identity from content hashing and clarified portable temporary-file handling.
- Corrected the deliverable status: request/session/acknowledgment schemas and fixtures have now been authored and tested; independent review is still required before implementation of the adapter.
