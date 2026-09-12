# YMnO3 antiferromagnetic Z-mode spin precession

[Data file](ymno3-spin-precession.csv) · [Configured session](ymno3-spin-precession.trksess) · [Published example index](README.md) · [Publication](https://doi.org/10.1038/s41467-020-19749-y)

## Data and interpretation

Tzschaschel, Satoh and Fiebig measure time-resolved Faraday rotation in YMnO3 after an ultrafast circularly polarized pump pulse. The damped oscillation following the pump/probe overlap is the antiferromagnetic Z-mode spin precession.

The publication fits the oscillatory signal with

`Phi(t) = A0 + A1*exp(-t/t1) + A2*exp(-t/tau)*sin(omega*t + phi0)`.

The first exponential models a short-lived parasitic/thermal contribution. The configured Data Tool session therefore retains the complete published raw trace but excludes measurements before **5 ps**, where that transient matters, and fits the later signal with Data Tool's built-in damped-oscillation model:

`y = b + exp(-t/tau) * [s*sin(2*pi*t/T) + c*cos(2*pi*t/T)]`.

The paper describes the exemplary oscillation as having a period of about **18.2 ps** and an initial phase of about **0.1 rad**. Its source-data temperature scans near 30 K report relaxation times around **145-150 ps** with fit standard errors around **4 ps**.

## Data Tool comparison

An independent equal-scatter least-squares fit to the deposited raw points with `t >= 5 ps` gives:

| Quantity | Result |
| --- | ---: |
| baseline `b` | 0.00103354336 |
| sine coefficient `s` | 0.00225527825 |
| cosine coefficient `c` | 0.000202098457 |
| period `T` | 18.178629 ± 0.008702 ps |
| relaxation time `tau` | 148.925 ± 3.769 ps |
| equivalent amplitude | 0.0022643153 |
| equivalent phase | 0.08937 rad |
| estimated residual scatter | 0.000104458 arb. u. |

This closely recovers the oscillation parameters described and tabulated by the publication.

The source workbook does **not** provide a point-by-point measurement standard uncertainty for this trace. Data Tool therefore uses equal unknown scatter estimated from the residuals. The resulting parameter standard errors are conditional on that model and should not be interpreted as independently published point-error propagation.
