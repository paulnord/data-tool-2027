# PWN luminosity versus light-cylinder magnetic field

[Data file](published-pwn-luminosity-vs-blc.csv) · [Example documentation index](published-examples.md) · [Publication](https://doi.org/10.1093/mnras/stab025)

## Data and interpretation

35 rows in logarithmic coordinates. Select columns 1 and 2 and fit a line; the slope is the power-law exponent. The later columns retain physical values and asymmetric errors. These are already logarithms: the graph's Log X and Log Y checkboxes only change display and do not perform this transformation for fitting.

Published exponent: 1.83 ± 0.19; reduced χ² = 4.59. Our slope and statistic are close.

The supplied symmetric log-space helper is [log10(L+upper) − log10(L−lower)]/2. This choice is explicit in the CSV, but is not established as the authors' exact weighting convention. Distance-related uncertainty and substantial intrinsic scatter limit interpretation; see the [shared discussion](published-examples.md). Our standard errors below use the helper errors without rescaling by residual scatter.

The raw luminosity entries for the especially influential J1016−5857 and J1048−5832 rows were checked against the published table. This review did not complete a full transcription audit of every pulsar row. The reason for any remaining difference in the published fit is unresolved; rounding alone has not been demonstrated as the explanation.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### pwn-blc

Equation: `a+b*x`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `a = 0`, `b = 1`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| a | 25.29426549 | 0.39443787 |
| b | 1.81782587 | 0.086727097 |

Reduced weighted objective on selected rows: **4.67025478**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](published-examples.md) before comparing standard errors or goodness-of-fit statistics.
