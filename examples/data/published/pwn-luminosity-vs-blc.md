# PWN luminosity versus light-cylinder magnetic field

[Data file](pwn-luminosity-vs-blc.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/stab025)

## Data and interpretation

35 rows in logarithmic coordinates. Select columns 1 and 2 and fit a line; the slope is the power-law exponent. The later columns retain physical values and asymmetric errors. These are already logarithms: the graph's Log X and Log Y checkboxes only change display and do not perform this transformation for fitting.

Published exponent: 1.83 ± 0.19; reduced χ² = 4.59. Our slope and statistic are close. Multiplying the Data Tool slope standard error 0.08673 by √4.59 gives 0.1858, consistent with the reported 0.19; that supports a residual-scaling explanation without establishing the authors' exact covariance calculation.

The supplied symmetric log-space helper is [log10(L+upper) − log10(L−lower)]/2. This choice is explicit in the CSV, but is not established as the authors' exact weighting convention. Distance-related uncertainty and substantial intrinsic scatter limit interpretation; see the [shared discussion](README.md). Our standard errors below use the helper errors without rescaling by residual scatter.

All 35 source rows were checked against the published tables; the raw values and asymmetric errors match. The logarithmic coordinates and symmetric helper errors are derived quantities. The remaining small differences are consistent with the documented uncertainty-convention difference, but this does not establish the authors' exact covariance calculation.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### pwn-blc

Equation: `b+m*x`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `b = 25`, `m = 1.8`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| b | 25.29426549 | 0.39443787 |
| m | 1.81782587 | 0.086727097 |

Reduced weighted objective on selected rows: **4.67025478**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
