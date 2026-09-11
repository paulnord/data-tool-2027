# ASASSN-14li radio light curve

[Data file](asassn14li-radio.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/sty077)

## Data and interpretation

104 flux-density observations, with time in days relative to MJD 56983.6, flux density in μJy, and supplied Y standard deviations. All CSV rows were checked against the published table during review.

The all-data exponential gives decay time 66.0572 ± 2.7753 d and background 239.8819 ± 8.1384 μJy; the publication reports 66 ± 3 d and 244 ± 8 μJy. The shifted power model fixes the exponent at −5/3. For the early exponential, select only times at or below 200 d (29 observations) and omit the background.

The early decay time is 87.2955 ± 3.2840 d, compared with the reported 87 ± 6 d. Rescaling our standard error by the square root of reduced χ² gives about 5.83 d. This illustrates the importance of uncertainty conventions; it does not establish the authors' exact procedure. Radio results are close, but the published statistics are not exact regression targets.

In the power equations, dividing time by 100 d changes only the amplitude convention. Compare the shift and exponent directly; compare amplitudes only after accounting for that normalization.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### radio-exp

Equation: `C+A*exp(-x/tau)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `C = 244`, `A = 2500`, `tau = 66`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| C | 239.8818744 | 8.1383948 |
| A | 2815.455822 | 109.26517 |
| tau | 66.05719039 | 2.7752658 |

Reduced weighted objective on selected rows: **0.959938237**.

### radio-power

Equation: `C+A*((x-t0)/100)^(-5/3)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `C = 180`, `A = 1800`, `t0 = -47`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| C | 178.0205024 | 10.532923 |
| A | 1247.988646 | 113.25246 |
| t0 | -47.23359554 | 4.7046357 |

Reduced weighted objective on selected rows: **0.916040392**.

### radio-early-exp

Equation: `A*exp(-x/tau)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `A = 2500`, `tau = 87`.

Select X ≤ 200 d.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| A | 2796.901553 | 88.714869 |
| tau | 87.29554157 | 3.2840247 |

Reduced weighted objective on selected rows: **3.14952006**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
