# Nonlinear fitting models

Choose a model after loading an ordinary data file. Selecting one of these models suggests starting values from the included observations; it does not run a fit. Edit those values and fix any parameters known independently, then click **Fit selected observations**. A fit is local: try alternative starts when a curve is poorly determined, particularly for oscillations. No point is removed automatically.

| Model                        | Equation                                                  | Parameters and units                                                                                                                 |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Exponential · fit decay time | `y = b + A exp(-x/tau)`                                   | b and A: y-unit; tau: positive x-unit. The fitted decay rate is `1/tau`.                                                             |
| Power law · fit exponent     | `y = b + A (x/xref)^n`                                    | b and A: y-unit; n: dimensionless. xref is exactly one declared x-unit; included x must be positive.                                 |
| Gaussian peak                | `y = b + A exp(-0.5*((x-mu)/sigma)^2)`                    | b and peak height A: y-unit; center mu and positive width sigma: x-unit. This sigma describes the peak, not measurement uncertainty. |
| Damped oscillation           | `y = b + exp(-x/tau)*(s*sin(2*pi*x/T) + c*cos(2*pi*x/T))` | b, s and c: y-unit; positive period T and decay time tau: x-unit. s and c describe phase without a discontinuous phase parameter.    |
| Lorentzian peak              | `y = b + A/(1+((x-mu)/gamma)^2)`                          | b and peak height A: y-unit; center mu and positive half-width gamma: x-unit. Full width at half maximum is `2*gamma`.               |

The supplied-rate exponential and supplied-exponent power law remain available. The new decay-time model describes decay toward a background, with either sign of amplitude; it does not fit an exponential growth rate. A peak amplitude may also be negative to describe a dip. Units are labels, never guessed conversions. Unit entry preserves case.

Ordinary synthetic examples are in `examples/data/exponential-decay.csv`, `power-law-free.csv`, `gaussian.csv`, `damped-sine.csv` and `lorentzian.csv`. Use the **Examples** menu to open them directly, or choose **Data… → Load file…**; these files are also included in the normal Examples directory. They contain no fitting settings or automatic uncertainty assignments.

## Numerical method and diagnostics

The implementation is pure TypeScript. It uses analytic Jacobians and damped Gauss–Newton steps (Levenberg–Marquardt form). Each step solves the column-scaled, augmented least-squares problem with the existing pivoted, twice-reorthogonalized QR; it never forms or inverts normal equations. Fixed values are excluded from optimization. Nonpositive widths, periods and decay times are rejected at every trial.

The initial damping is 0.001. Accepted steps reduce damping by three; rejected trials increase it tenfold. Limits are 300 iterations, 30 trial steps per iteration and 20 million observation evaluations. Exceeding them is an explicit failure, not a successful fit. Stops use a scaled gradient, small steps or an undamped projected residual whose predicted reduction is no larger than 32 machine epsilons times the objective. The latter handles floating-point stationarity without accepting a tiny step merely because damping became large.

Final rank and covariance use the **undamped physical Jacobian**, with the existing normalized QR threshold `1e-12`. Initial singularity may be escaped by damping; final rank deficiency is rejected explicitly. Numerical overflow and convergence failures are reported, and cannot overwrite a newer worker result. Rank diagnostics concern local identifiability; they do not establish a unique global optimum.

When nonlinear parameters are free, standard errors, marginal intervals and pointwise mean bands use a local Jacobian approximation. They retain the existing distinction between supplied absolute uncertainty and residual-estimated scatter. They are suppressed when inference assumptions are unsupported, and Q is unavailable (`nonlinear-reference-distribution`). Fixing every nonlinear shape parameter restores a model linear in the remaining amplitudes/background, so the existing linear inference rules apply. An all-fixed model only evaluates residuals. These models use positive domains, not a general user-defined bounds facility; symmetric local intervals are not constrained confidence regions.

The damped oscillation solver is local and does not perform the separate sine model's bounded frequency scan. The report warns that other minima may exist. Confidence intervals do not account for choosing a basin, model or exclusions after examining the data.

## Independent validation

`tests/fit/nonlinear-reference.json` records independent SciPy least-squares optima, complex-step Jacobians and SVD covariance for all five models, including fixed-background and fixed-shape cases. The test-only generator records NumPy/SciPy versions and PCG64 seeds. SciPy is not a runtime dependency. See [SciPy's least-squares documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html) for the independent reference solver.

Tests compare coefficients, weighted objectives and full covariance, check analytic derivatives by finite differences, reverse row order, exclude observations, transform x units including power-law covariance cross terms, evaluate all-fixed models, and reject invalid domains and rank loss. A separate high-signal ensemble uses 500 experiments per model (2,500 total), with a registered family-wise alpha of 0.001 over 19 parameter-coverage gates and independently calculated binomial thresholds. This supports local interval behavior in these specified regimes; it does not establish coverage for low signal, poorly sampled oscillations, weak identification or every possible starting value.

The scientific core remains independent of React, native APIs, file access and generators. All random generation and independent numerical reference tooling stay under tests/scripts.
