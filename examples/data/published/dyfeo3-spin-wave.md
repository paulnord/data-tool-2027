# DyFeO3 coherent antiferromagnetic spin wave

[Data file](dyfeo3-spin-wave.csv) · [Configured session](dyfeo3-spin-wave.trksess) · [Published example index](README.md) · [Publication](https://doi.org/10.1038/s41567-021-01290-4) · [Source data](https://doi.org/10.5281/zenodo.4716539)

## Data and interpretation

Hortensius et al. measure coherent antiferromagnetic spin waves in DyFeO3. The CSV contains the authors' deposited **Figure 1 reflection-geometry** time-resolved Kerr/polarization-rotation trace after 3.1 eV optical pumping. The publication states that the thick solid curves in Figure 1 are **exponentially damped sine fits**.

The configured session selects the later portion, `t >= 25 ps`, where the propagating oscillation is cleanly visible, and fits Data Tool's built-in model:

`y = b + exp(-t/tau) * [s*sin(2*pi*t/T) + c*cos(2*pi*t/T)]`.

## Data Tool comparison

An independent equal-scatter least-squares fit to those selected source points gives:

| Quantity | Result |
| --- | ---: |
| baseline `b` | -2.042563 ± 0.011373 |
| sine coefficient `s` | -0.723132 ± 0.086734 |
| cosine coefficient `c` | -0.548585 ± 0.087087 |
| period `T` | 4.520836 ± 0.005684 ps |
| frequency | 221.198 GHz |
| relaxation time `tau` | 85.42 ± 12.48 ps |
| estimated residual scatter | 0.169371 arb. u. |

The fitted frequency, about **221 GHz**, agrees with the reflection-mode frequency scale reported in the paper. The fitted relaxation time, **85.4 ps**, is also consistent with the paper's separate Extended Data Figure 5 statement that a damped-sine fit to a propagating-magnon reflection trace gives a lifetime of **about 85 ps**.

That last comparison needs a caveat: the publication does not state that Extended Data Figure 5 uses this exact Figure 1 deposited series or the identical `t >= 25 ps` window. We therefore label the lifetime agreement as a comparison, not an exact reconstruction of the authors' Extended Data fit.

The deposited Figure 1 trace has no point-by-point measurement standard uncertainties, so Data Tool estimates a common scatter from the residuals and reports conditional parameter errors.
