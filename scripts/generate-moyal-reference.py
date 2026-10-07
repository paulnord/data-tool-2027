"""Generate reproducible Moyal examples and independent fit/PDF references.

Run from the repository root with NumPy and SciPy.
PDF references use scipy.stats.moyal; fit/covariance references use
SciPy least_squares/SVD independently of the browser implementation.
"""
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import least_squares
from scipy.stats import moyal

SEED = 20261007


def density(z):
    return moyal.pdf(z)


def model(x, p):
    b, area, mpv, width = p
    return b + area / width * density((x - mpv) / width)


x = np.arange(0, 101, dtype=np.int64)
truth = np.array([0, 10000, 50, 5.0])
# Independent Poisson channel counts, integrated over unit-width bins.
expected = truth[0] + truth[1] * (moyal.cdf(x + .5, loc=truth[2], scale=truth[3])
                                  - moyal.cdf(x - .5, loc=truth[2], scale=truth[3]))
y = np.random.default_rng(SEED).poisson(expected)
# The sqrt(N) estimate needs a documented positive convention at N=0.
sigma = np.sqrt(np.maximum(y, 1))
initial = np.array([0, 9000, 48, 6.0])
cases = []
for fixed in [[], [0], [2, 3]]:
    free = np.array([i for i in range(4) if i not in fixed])
    start = initial.copy()
    start[fixed] = truth[fixed]

    def full(p):
        result = start.copy()
        result[free] = p
        return result

    result = least_squares(
        lambda p: (model(x, full(p)) - y) / sigma,
        start[free], jac="3-point", x_scale="jac",
        bounds=([1e-12 if i == 3 else -np.inf for i in free], np.inf),
        ftol=1e-13, xtol=1e-13, gtol=1e-13, max_nfev=10000,
    )
    _, singular, vt = np.linalg.svd(result.jac, full_matrices=False)
    covariance = (vt.T / singular**2) @ vt
    cases.append(dict(fixed=fixed, coefficients=full(result.x).tolist(),
                      objective=float(result.fun @ result.fun), covariance=covariance.tolist()))

pdf_z = [-7, -5, -3, -2, -1, 0, .5, 1, 2, 4, 8, 16, 32, 64, 100, 1000]
pdf = [dict(z=z, value=float(moyal.pdf(z))) for z in pdf_z]
reference = dict(generator="scripts/generate-moyal-reference.py", numpy=np.__version__, scipy=scipy.__version__,
                 seed=SEED, pdf=pdf, expected=expected.tolist(), x=x.tolist(), y=y.tolist(), sigma=sigma.tolist(),
                 truth=truth.tolist(), initial=initial.tolist(), cases=cases)
Path("tests/fit/moyal-reference.json").write_text(json.dumps(reference, indent=2) + "\n")

notes = (
    "Synthetic data: integer Poisson counts in unit-width channels; not measured detector data.\n"
    "Generating means: 10000 times the Moyal probability integrated from channel-0.5 to channel+0.5.\n"
    "Truth: background=0 count/channel, total expected events=10000, mpv=50 channel, w=5 channel.\n"
    "Assigned Poisson error estimate: sqrt(N) count; empty channels use 1 count (sqrt(max(N,1))).\n"
    f"NumPy PCG64 seed {SEED}; NumPy {np.__version__}, SciPy {scipy.__version__}.\n"
    "Generator: scripts/generate-moyal-reference.py.\n"
    "Reference: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.moyal.html\n"
    "Open moyal.trksess for assigned uncertainties and starting values; or import the CSV,\n"
    "assign column 3 as Y uncertainty, enable advanced models, and select Moyal peak.\n"
    "b starts fixed at zero. The fitted curve is evaluated at channel centers, not bin-integrated.\n"
    "Weighted least squares with observed-count errors is an approximation, especially for sparse channels.\n"
    "Gaussian/model assumptions remain unconfirmed; conditional inference is enabled for approximate errors.\n"
    "A is full-curve area in count*channel; unit-width channels give it the scale of total counts."
)
headers = ["Channel (channel)", "Counts (count)", "Poisson uncertainty (count)"]
table = [[format(v, '.17g') for v in row] for row in zip(x, y, sigma)]
csv = "\n".join("# " + line for line in notes.splitlines()) + "\n"
csv += ",".join(headers) + "\n" + "\n".join(",".join(row) for row in table) + "\n"
Path("examples/data/moyal.csv").write_text(csv)

request = dict(
    format="tracker-fit-request", version=1,
    requestId="60aa0000-0000-4000-8000-000000000001",
    snapshotId="60aa0000-0000-4000-8000-000000000002",
    source=dict(application="Synthetic Moyal example", version="2026-10-07", context=notes, fileName="moyal.csv"),
    dataset=dict(id="synthetic-moyal", label="Synthetic Moyal peak",
                 xColumn=dict(id="x", label="Channel", unit="channel"),
                 yColumn=dict(id="y", label="Counts", unit="count"),
                 assumptions=dict(exactX="asserted", gaussianIndependent="unknown", correctModel="unknown"),
                 rows=[dict(id=f"moyal-{i}", x=int(a), y=int(b), included=True, missingReason=None)
                       for i, (a, b) in enumerate(zip(x, y))]),
    uncertainty=dict(kind="supplied-per-row", errorStructure="uncorrelated",
                     sigmaByRow={f"moyal-{i}": float(s) for i, s in enumerate(sigma)},
                     provenance=dict(kind="user-asserted", description="Poisson error estimate sqrt(N); sigma=1 count for empty channels")),
)
session = dict(
    format="tracker-fit-session", version=7, engine="qr-lm-3", request=request,
    settings=dict(model="moyal", parameters=[dict(value=float(v), fixed=i == 0) for i, v in enumerate(initial)],
                  excludedIds=[], conditionalInference=True, physicalTimeConfirmed=False, selectionAfterInspection=False),
    workspace=dict(kind="single-fit"), view=dict(showResiduals=True, showGuides=True, showErrorBars=True),
)
Path("examples/data/moyal.trksess").write_text(json.dumps(session, indent=2) + "\n")
print("Wrote Moyal CSV, session, and numerical references.")
