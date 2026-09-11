# BESIII p pbar pi0 continuum cross section

[Data file](besiii-ppbarpi0-continuum.csv) · [Configured session](besiii-ppbarpi0-continuum.trksess) · [Published example index](README.md) · [Publication](https://doi.org/10.1103/PhysRevD.106.054014)

## Data and interpretation

Wang and Yuan combine 22 BESIII measurements of the Born cross section for `e+e- -> p pbar pi0` between 3.65 and 4.60 GeV. Their fit is performed on the **dressed** cross section, so this example multiplies each tabulated Born value and its statistical uncertainty by the paper's vacuum-polarization factor.

The continuum model is

`C/x^(2*lambda)`

where `x = sqrt(s)` in GeV. This is the paper's `C/s^lambda` written using the tabulated center-of-mass energy.

The publication reports

- `C = (3.07 +/- 0.58)e5 GeV^(2lambda) pb`
- `lambda = 3.96 +/- 0.07`
- `chi^2/NDF = 13.0/20`, so reduced `chi^2 = 0.65`.

The authors use only statistical uncertainties in the fit because the roughly 6.5% systematic cross-section uncertainty is correlated across all points.

## Data Tool reproduction

The configured session starts from `C = 3.0e5` and `lambda = 4.0`. Two measurements have asymmetric statistical errors; the CSV uses the average upper/lower magnitude as a symmetric standard deviation.

With that explicit convention, an independent weighted least-squares check gives:

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| C | 306373.71 | 58293.96 |
| lambda | 3.96443325 | 0.06906848 |

`chi^2 = 12.892445` for 20 degrees of freedom, or reduced `chi^2 = 0.644622`.

That agreement is close enough to make this a particularly clean publication benchmark: real particle-physics data, unequal uncertainties, a nonlinear power law in the natural energy coordinate, published parameter errors, and a published goodness-of-fit statistic.
