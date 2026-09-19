# ASASSN-14li X-ray light curve

[Data file](asassn14li-xray.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/sty077)

**Reproduction status: not reproduced from the printed table.** Data Tool and independent SciPy calculations agree for the documented inputs, but none of the publication's three fitted X-ray results is recovered. Three early observations omitted from the printed table are the likely explanation.

## Data and interpretation

95 flux observations, with time in days relative to MJD 56983.6. Flux and its standard deviation are in 10⁻¹² erg s⁻¹ cm⁻². Every CSV row was checked against the published table.

| Quantity | Reproduced from CSV | Reported in publication |
| --- | ---: | ---: |
| Exponential decay time (d) | 178.5794 ± 1.9134 | 187 ± 6 |
| Shift for fixed −5/3 power (d) | −123.9178 ± 2.1776 | −155 ± 9 |
| Free power index, shift fixed at −132.35 d | −1.78129 ± 0.01452 | −1.60 ± 0.05 |
| Reduced χ², respective models | 7.9313; 10.5684; 9.9432 | 8.54; 13.99; 14.95 |

Data Tool and independent SciPy optimization agree using these rows and settings. Trying the tabulated count rates instead of flux also does not reproduce the cited numbers.

## Likely explanation: an incomplete fit table

The [paper](https://arxiv.org/abs/1801.03094) says Swift monitoring began at MJD 56991.5, but its 95-row Appendix Table A2—and this CSV—begin at MJD 56998.259. The [Swift archive](https://heasarc.gsfc.nasa.gov/W3Browse/catalog/swiftmastr.html) identifies three earlier photon-counting observations between those dates. A modern [2SXPS reduction of the source](https://www.swift.ac.uk/2SXPS/2SXPS%20J124815.1%2B174627) includes those epochs.

As a diagnostic only, mapping the modern reduction to the Table A2 scale on their shared epochs and adding the three early points gives `tau = 185.28 d`, shifted-power `t0 = -153.44 d`, and free index `p = -1.60496`; residual-scaled errors and reduced chi-square values also lie close to the paper's Table 1. This strongly suggests that the authors fit early observations omitted from Appendix Table A2.

That diagnostic is not an exact reproduction: 2SXPS uses a different reduction, and the exact 2017 fluxes and errors for the missing epochs are unavailable. They must not be silently spliced into this CSV. Keep the 95 published rows unchanged and treat this as a provenance and replication exercise rather than a Data Tool validation failure.

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
