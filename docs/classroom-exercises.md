# Example datasets

Use **Data… → Load file…** to browse ordinary files. The desktop file chooser initially opens the bundled Examples directory, which contains example CSV data and prepared `.trksess` analyses. There is no special example selector. The same files live in `examples/data/` in the checkout. CSVs can also be shared, opened through **Data…**, pasted, or used by another analysis program. They contain column headings, explicit units where supplied, and observations. Generated examples include a comment identifying their synthetic origin. They do not contain hidden fit settings or executable generators.

| CSV file in `examples/data/`                                            | Model or analysis                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [MillikanData.csv](../examples/data/MillikanData.csv) | Supplied oil-drop measurements with gaps and multiple drift intervals. Time in seconds; three position columns in millimeters. |
| [constant-speed.csv](../examples/data/constant-speed.csv)               | Linear position versus time; intercept and constant velocity.                                            |
| [spring-extension.csv](../examples/data/spring-extension.csv)           | Linear force versus extension; stiffness and force offset, with free or fixed intercept. |
| [ball-toss.csv](../examples/data/ball-toss.csv)                         | Quadratic height versus time; acceleration is twice the quadratic coefficient.                             |
| [exponential-decay.csv](../examples/data/exponential-decay.csv)         | Exponential decay with fitted background and decay time.       |
| [oscillation.csv](../examples/data/oscillation.csv)                     | Oscillation with offset, phase and a fitted period.                                       |
| [unequal-uncertainties.csv](../examples/data/unequal-uncertainties.csv) | Linear data with unequal standard uncertainties supplied in the third column.                                  |

`MillikanData.csv` contains columns `t`, `mass_B`, `mass_A`, and `mass_C`, with some missing observations. It can be used to inspect multiple data series and select drift intervals for line fits. Time is in seconds and all three measurement columns are in millimeters, as confirmed by the instructor. Units are declared in the CSV headings; numerical observations and missing values are unchanged.

Loading a CSV does not automatically fit, assert statistical assumptions or assign an uncertainty column. Review columns/units and explicitly choose a model and uncertainty interpretation. For the unequal-uncertainty example, assign the standard-deviation column to Y uncertainty in the data editor. Use **Export CSV…** for the table and **Save session** for a reproducible analysis with settings.

Prepared sessions include a selected model, constraints and documented noise provenance. Their observations and settings remain in normal `.trksess` files; no sample is loaded implicitly on startup.

## Provenance and numerical validation

The generated datasets are synthetic. `MillikanData.csv` is an instructor-supplied file, with original numerical observations preserved and instructor-confirmed units added to the headings. The first two are hand-authored examples: constant-speed data are near `position = 0.35 + 1.4*time`; spring data are near `force = 0.1 + 25*extension`. Their small deviations are illustrative and do not establish a Gaussian noise model.

The original CSVs retain observations from the corresponding prepared sessions (except the updated exponential example described below): ball toss uses `height = 2 + 10*time - 4.905*time²`; exponential uses `signal = 0.5 + 3*exp(-0.7*x)`; oscillation uses `y = 1 + 2*sin(2*pi*time/3) + 0.75*cos(2*pi*time/3)`; unequal uncertainties use `y = 1 + 2*x` with `sigma = 0.04 + 0.18*x`. Their original seeds and generation assumptions are in the paired session provenance. Finite noisy samples need not recover the generating coefficients exactly.

Tests read these same static CSV files through production parsing and table validation, check precision and session round trips, and run descriptive fits. The browser suite verifies ordinary file opening and reopening. Internal Monte Carlo generators and scientific acceptance tests remain under `tests/`; they are not exposed as production test controls or included in the application module graph.

## Further nonlinear examples

The same directory now also contains `power-law-free.csv`, `gaussian.csv`, `damped-sine.csv` and `lorentzian.csv`; `exponential-decay.csv` is updated for the fitted-decay-time example. The corresponding models support starting values and fixed or free shape parameters. Peak widths are shape parameters, not measurement uncertainties. See [model equations and diagnostics](nonlinear-fits.md).

These five nonlinear datasets were generated by `scripts/generate-nonlinear-reference.py` with NumPy PCG64 seeds 93000–93004. Their generating parameters, exact observations and independent reference fits are recorded in `tests/fit/nonlinear-reference.json`. The updated exponential example uses `signal = 0.4 + 3*exp(-time/2.2)`; it is separate from the older prepared supplied-rate exponential session.

## Published examples

Twelve publication-backed CSV files have [individual documentation pages and a comparison index](../examples/data/published/README.md). These explain the physical quantities, column mapping, equations, selected rows, uncertainty conventions and independently reproduced results. Short CSV header notices point to the accompanying page when results differ from the publication. Several differences reflect different methods or datasets; unresolved differences are identified without attributing an error to the authors. The documentation travels with the example files.
