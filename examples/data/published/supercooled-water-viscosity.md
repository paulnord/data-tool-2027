# Smoothed supercooled-water viscosity

[Data file](supercooled-water-viscosity.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1073/pnas.1508996112)

## Data and interpretation

55 temperatures in K and viscosities in mPa·s. These are rounded, smoothed Table S2 values, not 55 independent raw measurements. The source describes Brownian-motion measurements in four capillaries, not a capillary-flow viscosity experiment.

The fitted coefficients closely recover the smoothing function: A = 0.13067029 mPa·s, Ts = 224.79807 K and g = 1.7046079. The reported smoothing coefficients are 0.13069 mPa·s, 224.80 K and 1.7044. Our reduced χ² is only 0.00004496. The paper's 0.79 describes the original measurements about the smoothing function, not a refit of its 55 smoothed values. This distinction explains the statistic mismatch.

The helper errors use sigma/eta = sqrt(0.023² + [0.15*1.7044/(T−224.80)]²). Keep these supplied weights fixed while fitting; do not silently recompute them from the current parameters. They do not turn smoothed values into independent observations. Treat the numerical standard errors below as conditional calculations, not fresh experimental precision estimates. The separate multi-literature fit and its errors concern another dataset.

The [author-hosted paper and supporting information](https://ilm-perso.univ-lyon1.fr/~fcaupin/pdf/Dehaoui_PNAS_2015_full.pdf), Supporting Information “Viscosity Values,” explains how Table S2 was produced.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### water

Equation: `A*(x/Ts-1)^(-g)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `A = 0.13069`, `Ts = 224.8`, `g = 1.7044`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| A | 0.1306702915 | 0.0037892026 |
| Ts | 224.7980714 | 0.69608488 |
| g | 1.704607902 | 0.037409019 |

Reduced weighted objective on selected rows: **4.49615383e-05**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
