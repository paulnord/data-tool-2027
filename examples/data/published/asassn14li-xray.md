# ASASSN-14li X-ray light curve

[Data file](asassn14li-xray.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/sty077)

## Data and interpretation

95 flux observations, with time in days relative to MJD 56983.6. Flux and its standard deviation are in 10⁻¹² erg s⁻¹ cm⁻². Every CSV row was checked against the published table.

| Quantity | Reproduced from CSV | Reported in publication |
| --- | ---: | ---: |
| Exponential decay time (d) | 178.5794 ± 1.9134 | 187 ± 6 |
| Shift for fixed −5/3 power (d) | −123.9178 ± 2.1776 | −155 ± 9 |
| Free power index, shift fixed at −132.35 d | −1.78129 ± 0.01452 | −1.60 ± 0.05 |
| Reduced χ², respective models | 7.9313; 10.5684; 9.9432 | 8.54; 13.99; 14.95 |

Data Tool and independent SciPy optimization agree using these rows and settings. Trying the published count rates instead of flux also did not reproduce the cited numbers. The cause remains unresolved. Numerical precision, weighting, selection or other analysis details could contribute; we have not established that the publication is incorrect. No rounding-sensitivity study has yet determined whether tabulation precision explains the difference.

Large residuals relative to supplied errors remain with all three models. Successful optimization does not establish that a simple decay describes all the variability.

In the power equations, dividing time by 100 d changes only the amplitude convention. Compare the shift and exponent directly; compare amplitudes only after accounting for that normalization.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### xray-exp

Equation: `A*exp(-x/tau)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `A = 25`, `tau = 187`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| A | 22.31755808 | 0.21380601 |
| tau | 178.5794167 | 1.9133851 |

Reduced weighted objective on selected rows: **7.93125468**.

### xray-power

Equation: `A*((x-t0)/100)^(-5/3)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `A = 80`, `t0 = -155`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| A | 43.61978962 | 0.78757038 |
| t0 | -123.9177654 | 2.1775704 |

Reduced weighted objective on selected rows: **10.5684468**.

### xray-index

Equation: `A*((x-t0)/100)^p`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `A = 80`, `t0 = -132.35` (fixed), `p = -1.6`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| A | 51.50231414 | 0.71841778 |
| t0 | -132.35 | fixed |
| p | -1.781285197 | 0.014524129 |

Reduced weighted objective on selected rows: **9.94322594**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
