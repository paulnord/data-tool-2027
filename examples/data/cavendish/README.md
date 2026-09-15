# Cavendish: two damped oscillations

Open `cavendish-multi-interval.trksess` through **Data… → Load file** and accept
**Use these data**. It restores the multi-interval workspace with **Time (s)**
as X and **x (m)** as Y. Select each interval and press **Fit Oscillation 1** or
**Fit Oscillation 2**. Opening the file does not run a fit.

The two independently selected, inclusive ranges are **0–1400 s** and
**1800–4500 s**. Both use

`x(t) = b + exp(-t/tau) [s sin(2 pi t/T) + c cos(2 pi t/T)]`.

All five parameters are free. T and tau are in seconds; b, s and c are in metres.
The saved starting estimates come from the observations within each interval.
The time origin remains the original CSV's zero for both fits; s and c therefore
refer to that common origin. No continuity or shared parameters are imposed.
Fitted guides show each baseline and damping envelope.

The file supplies no measurement uncertainties. This setup uses equal weights
and estimates scatter separately from each interval's residuals. Statistical
assumptions remain unconfirmed, so results are descriptive unless the user
explicitly accepts the assumptions. Acquisition, timing and calibration
uncertainties cannot be established from the CSV alone. These fits do not
determine the gravitational constant.

With the supplied starting values, the current solver gives approximately:

| Interval    | Complete observations |    b (m) |   T (s) | tau (s) |
| ----------- | --------------------: | -------: | ------: | ------: |
| 0–1400 s    |                   279 | 0.615553 | 633.765 | 994.329 |
| 1800–4500 s |                   536 | 0.824980 | 638.749 | 969.693 |

These values provide a reproduction check, not independent reference measurements.
Different selected ranges or model assumptions can change them.

`Cavendish.csv` is the exact file supplied by Paul Nord, with no rounding,
smoothing, time shifting or deleted rows. It contains 919 rows, elapsed time
from 0 to 4590 s in 5 s steps, calibrated x/y positions in metres, and image
coordinates in pixels. Twelve rows have missing position/image values; their
frame numbers and times remain present. There are 907 complete time/x pairs.
The original frame numbers satisfy `Frame = 69 + Time / 5`. The session embeds
every source cell and retains the unused columns.

CSV SHA-256:
`0380dd44f812bb372369a01fe73021e115bd843b188e4c6647e632adf621996b`.

The session uses the documented v6 workspace format. **Save session** writes the
active workspace's current settings for reopening; reports and plots remain
separate exports.
