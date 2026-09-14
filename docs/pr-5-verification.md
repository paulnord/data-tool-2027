# PR #5 verification and corrections

Verified on macOS arm64, 2026-09-14, against the PR based on
`9ce88e45e9597acaddbceba5e8ccecd483e4b104`. These checks concern the
model-comparison, fit-guide and analysis-bundle additions. They do not establish
universal solver agreement or native printer behavior.

## Scientific and export corrections

- Known supplied Gaussian sigmas use AIC for ranking. The estimated-variance
  AICc correction applies only to the unknown-scatter path. A six-point line
  versus quadratic regression checks a case where the incorrect correction
  reversed the preferred model. Delta labels and weights follow the selected
  criterion. Extreme finite sigmas use stable log normalizers; unavailable or
  non-finite criteria cannot appear as available evidence.
- Oscillation phase and its propagated uncertainty no longer depend on a fixed
  absolute threshold in the chosen Y units. Tests compare equivalent metre and
  nanometre representations and cover zero amplitude.
- ROOT uses physical parameter coordinates and one-sided positive limits through
  `ROOT::Fit::Fitter`. This corrects invalid positive widths/decay times caused by
  an artificial upper bound of `1e300`. Failed convergence, bad covariance, and
  non-finite outputs fail explicitly. Zero residual scatter does not silently
  substitute unit-error standard errors.
- Generated C++ uses real-valued literals for custom arithmetic and escapes
  user-supplied labels. Python validates alternate metadata against its generated
  equation and broadcasts scalar custom predictions. Both programs preserve the
  CSV inclusion/missing-value contract; the ROOT parser accepts UTF-8 BOM and
  finite subnormal values while rejecting invalid numbers.

## Comparison workspace corrections

Comparison candidates and results survive navigation and main-source changes.
Each staged candidate identifies its dataset and offers an explicit refresh
from the current analysis. These snapshots are window-local and are not saved
in a single-fit session.

The data/residual inner frames have equal widths, one shared bottom X label,
a compact gap and a 3:1 height ratio. Responsive browser checks cover wide and
narrow viewports, small residual values, and the larger data frame when residuals
are hidden. The rendered paired-plot artifact was inspected visually.

## Validation

- `npm test`: 216 tests in 29 files passed.
- `npm run build` and `npm run build:web`: passed.
- `npm run test:e2e`: 110 tests passed, using an isolated local server.
- `npm run test:web`: 3 packaged-web tests passed.
- `npm run test:desktop`: 5 native tests passed.
- `npm run test:code-exports`: 14 cases passed with actual SciPy 1.18.1 and
  ROOT 6.40.04. The executable checks require successful ROOT status and compare
  every coefficient, in addition to verifying output artifacts. They cover
  representative line/acceleration, exponential, sine/damped sine, Gaussian,
  Lorentzian, power-law and custom models; fixed parameters; zero scatter; quoted
  labels; and rejected metadata/CSV inputs.
- TypeScript, scoped formatting, and `git diff --check`: passed.

The browser and native checks use local tools. Data Tool itself does not install
or execute SciPy or ROOT, add a network service, change the session schemas, or
compute Bayesian evidence. See [the methods and workflow](model-comparison-and-code-export.md)
for statistical conventions and remaining limitations.
