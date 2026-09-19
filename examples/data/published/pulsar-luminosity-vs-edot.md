# Pulsar luminosity versus spin-down power

[Data file](pulsar-luminosity-vs-edot.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/stab025)

## Data and interpretation

35 rows in logarithmic coordinates. Select columns 1 and 2 and fit a line; the slope is the power-law exponent. The later columns retain physical values and asymmetric errors. These are already logarithms: the graph's Log X and Log Y checkboxes only change display and do not perform this transformation for fitting.

Published exponent: 1.15 ± 0.11; reduced χ² = 3.43. Our statistic differs materially; matching a slope approximately does not establish reproduction of the published fit.

The supplied symmetric log-space helper is [log10(L+upper) − log10(L−lower)]/2. This choice is explicit in the CSV, but is not established as the authors' exact weighting convention. Distance-related uncertainty and substantial intrinsic scatter limit interpretation; see the [shared discussion](README.md). Our standard errors below use the helper errors without rescaling by residual scatter.

All 35 source rows were checked against the published tables; the raw values and asymmetric errors match. The logarithmic coordinates and symmetric helper errors are derived quantities, so no remaining difference has been traced to a transcription error.

The paper adopts ±40% distance uncertainty. Propagating d(1 ± 0.4) through L ∝ d² and taking half the resulting logarithmic span gives about 0.368 dex. As a diagnostic, imposing that as a minimum Y uncertainty on the three rows with smaller helper values gives slope m = 1.14582 and reduced χ² = 3.70277, much closer to the published 1.15 and 3.43. This is evidence that treatment of the stated distance uncertainty contributes to the discrepancy, but it remains a hypothesis: the paper does not specify this floor or the exact symmetrization and covariance scaling used for the fit.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### pulsar-edot

Equation: `b+m*x`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `b = -11`, `m = 1.2`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| b | -10.88749543 | 2.2163325 |
| m | 1.181074634 | 0.060970056 |

Reduced weighted objective on selected rows: **8.7327442**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
