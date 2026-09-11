# Numerical methods and validation

Data Tool is a general-purpose graphical tool for ordinary and weighted least-squares fitting of numerical observations. It uses established regression methods, makes the statistical assumptions explicit, and reports numerical failures rather than presenting them as precise results. The descriptions below specify the implemented methods and their limits; they are not a claim of formal certification or NIST endorsement.

## Fitting objective and numerical solution

A residual is observed Y minus the model prediction at X. With unknown equal scatter, the objective is the sum of squared residuals. With supplied standard uncertainties, the objective is the sum of squared residuals divided by their variances: weights are 1/σ². X is treated as exact. Logarithmic graph axes change only the display.

Models linear in their free parameters use column-scaled, pivoted, twice-reorthogonalized QR. Fixed-parameter contributions are removed before solving for free parameters. Rank is assessed using the documented normalized threshold of 10⁻¹². The solver does not explicitly invert normal equations. Rank loss prevents reporting a unique set of fitted parameters and ordinary confidence intervals.

Nonlinear models use damped Gauss–Newton steps in Levenberg–Marquardt form, with QR solutions and a final undamped Jacobian rank check. The fitted-period sine has a separate bounded frequency search. Custom equations use automatic differentiation and a structural check for linear dependence on free parameters. Iteration limits, invalid domains and convergence failures are explicit diagnostics. Local convergence does not establish a global optimum.

See the [scientific specification](scientific-spec.md), [nonlinear implementation and validation](nonlinear-fits.md), and [custom-equation reference](custom-equations.md) for algorithm details and model-specific limits.

## Statistical conventions

For full-rank linear fits, supplied absolute standard uncertainties determine covariance without rescaling to force reduced χ² to one. Unknown common variance is estimated from residuals using the residual degrees of freedom. Parameter standard errors come from the covariance diagonal. Marginal 95% intervals use normal quantiles for known uncertainty and Student-t quantiles for residual-estimated scatter. Mean-curve bands are pointwise confidence bands, not prediction intervals or simultaneous bands.

Inference requires the stated model and fixed values, exact X, and independent Gaussian errors with the stated uncertainty structure. Unknown assumptions can be explicitly accepted for conditional inference; that does not verify them. Known-false assumptions block inference. Descriptive fits remain available where supported.

Nonlinear covariance and intervals are local approximations. Q, the chi-square upper-tail probability, is withheld when free nonlinear parameters make the implemented reference distribution inapplicable. Residual patterns and a high R² cannot by themselves establish a valid model.

These conventions follow standard regression practice described in the NIST/SEMATECH handbook: [regression assumptions](https://www.itl.nist.gov/div898/handbook/pmd/section2/pmd21.htm), [weighted least squares](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd143.htm), and [residual diagnostics](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd44.htm).

## Measurement and analysis limits

Fit uncertainty is conditional on the inputs and model. The software does not calculate a complete measurement uncertainty budget. Uncertainty in X, fixed parameters, calibration and shared systematic effects may require additional methods. NIST's [measurement uncertainty overview](https://physics.nist.gov/cuu/Uncertainty/basic.html) describes the broader measurement context.

Intervals do not account for selecting models, ranges or exclusions after inspecting data. Separate curve and interval fits do not estimate cross-fit covariance, including when overlapping intervals reuse observations. There are no linked parameters or enforced continuity between interval fits.

The application preserves imported observations, missing values, explicit units and recorded provenance. Display rounding does not alter stored observations. Units are case-sensitive labels; the program neither silently converts values nor checks dimensional consistency of custom equations. Invalid imports preserve the current analysis.

## Verification evidence

The scientific suite compares fitted coefficients, objectives and covariance with independent numerical references. It also checks rank failures, fixed parameters, units, exclusions, missing data and file round trips. Monte Carlo tests assess confidence-interval behavior in specified linear and nonlinear regimes. Independent reference generators and random-data generators are test tooling, not application runtime components.

Relevant evidence is maintained in:

- [Scientific specification and acceptance criteria](scientific-spec.md).
- [Scientific tests](../tests/fit/), including linear reference comparisons, coverage tests and custom-equation checks.
- [Nonlinear reference results](../tests/fit/nonlinear-reference.json) and their [documented validation regimes](nonlinear-fits.md#independent-validation).
- [Browser workflow tests](../e2e/) for importing, fitting, display controls and reports.

Passing these checks supports the implementation in the tested regimes. It does not guarantee identifiability, convergence, interval coverage or model adequacy for every dataset. Reports retain the relevant diagnostics and limitations so the numerical result can be assessed in context.

## References and further reading

Data Tool brings established least-squares methods into an interactive analysis workflow: built-in and custom models, weighted fitting, independent fits across multiple intervals, and residual plots alongside the data. Rank and convergence diagnostics, parameter standard errors, and confidence intervals make the results assessable under explicit assumptions. Numerical tests compare results with independent references and check interval coverage in documented regimes. Original observations, units and analysis settings remain available for review, with reports ready to copy or print.

- [Bevington and Robinson: Data Reduction and Error Analysis (3rd edition, PDF)](https://experimentationlab.berkeley.edu/sites/default/files/pdfs/Bevington.pdf). Chapters 6–8 and 11 cover least-squares fitting and fit diagnostics.
- [JCGM GUM: Guide to the Expression of Uncertainty in Measurement](https://doi.org/10.59161/JCGM100-2008E). International framework for evaluating and combining measurement uncertainties.
- [EA-4/02: Uncertainty of Measurement in Calibration (PDF)](https://european-accreditation.org/wp-content/uploads/2018/10/EA-4-02.pdf). GUM-based calibration guidance, uncertainty budgets and expanded uncertainty.
- [AAPT: Undergraduate Physics Laboratory Recommendations (PDF)](https://www.aapt.org/resources/upload/labguidlinesdocument_ebendorsed_nov10.pdf). Curriculum guidance that includes professional uncertainty methods; not a competing numerical standard.

**Calibration scope.** For EA-4/02 calibration work, supplement the fit with an assessment of calibration, resolution, environmental and other systematic effects, including relevant correlations. These contributions and an appropriate coverage factor are needed for a complete expanded-uncertainty statement; Data Tool does not evaluate them automatically.
