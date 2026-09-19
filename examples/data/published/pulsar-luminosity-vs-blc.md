# Pulsar luminosity versus light-cylinder magnetic field

[Data file](pulsar-luminosity-vs-blc.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/stab025)

## Data and interpretation

35 rows in logarithmic coordinates. Select columns 1 and 2 and fit a line; the slope is the power-law exponent. The later columns retain physical values and asymmetric errors. These are already logarithms: the graph's Log X and Log Y checkboxes only change display and do not perform this transformation for fitting.

Published exponent: 1.59 ± 0.17; reduced χ² = 3.81. Our statistic differs materially; matching a slope approximately does not establish reproduction of the published fit.

The supplied symmetric log-space helper is [log10(L+upper) − log10(L−lower)]/2. This choice is explicit in the CSV, but is not established as the authors' exact weighting convention. Distance-related uncertainty and substantial intrinsic scatter limit interpretation; see the [shared discussion](README.md). Our standard errors below use the helper errors without rescaling by residual scatter.

All 35 source rows were checked against the published tables; the raw values and asymmetric errors match. The logarithmic coordinates and symmetric helper errors are derived quantities, so no remaining difference has been traced to a transcription error.

The paper adopts ±40% distance uncertainty. Propagating d(1 ± 0.4) through L ∝ d² and taking half the resulting logarithmic span gives about 0.368 dex. As a diagnostic, imposing that as a minimum Y uncertainty on the three rows with smaller helper values gives slope m = 1.61208 and reduced χ² = 3.71896, much closer to the published 1.59 and 3.81. This is evidence that treatment of the stated distance uncertainty contributes to the discrepancy, but it remains a hypothesis: the paper does not specify this floor or the exact symmetrization and covariance scaling used for the fit.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### pulsar-blc

Equation: `b+m*x`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `b = 25`, `m = 1.7`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| b | 24.61792429 | 0.37074379 |
| m | 1.723090579 | 0.085376892 |

Reduced weighted objective on selected rows: **7.76095239**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
