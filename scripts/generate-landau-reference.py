"""Generate reproducible Landau examples and independent fit/PDF references.

Run from the repository root with NumPy and SciPy >= 1.15.
The runtime port uses Boost coefficients. PDF spot checks instead use SciPy's
levy_stable quadrature; fit/covariance references use SciPy least_squares/SVD.
"""
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import least_squares
from scipy.stats import landau, levy_stable

MODE = -0.42931452986133525017
SCALE = 2 / np.pi
SEED = 20261006


def density(z):
    return SCALE * landau.pdf(SCALE * z + MODE)


def model(x, p):
    b, area, mpv, width = p
    return b + area / width * density((x - mpv) / width)


x = np.linspace(25, 160, 101)
truth = np.array([0, 150, 50, 5.0])
sigma = .025 * (1 + np.arange(len(x)) / len(x))
y = model(x, truth) + np.random.default_rng(SEED).normal(0, sigma)
initial = np.array([0, 130, 48, 6.0])
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

# Nolan's quadrature in levy_stable is independent of the Boost rational PDF.
pdf_z = [-3.5, -3, -2, -1, 0, .5, 1, 2, 4, 8, 16, 32, 64, 100]
pdf = [dict(z=z, value=float(SCALE * levy_stable.pdf(SCALE*z + MODE, 1, 1))) for z in pdf_z]
reference = dict(generator=__file__, numpy=np.__version__, scipy=scipy.__version__,
                 seed=SEED, pdf=pdf, x=x.tolist(), y=y.tolist(), sigma=sigma.tolist(),
                 truth=truth.tolist(), initial=initial.tolist(), cases=cases)
Path("tests/fit/landau-reference.json").write_text(json.dumps(reference, indent=2) + "\n")

notes = (
    "Synthetic classroom data: sampled Landau curve; not measured detector data or Poisson histogram counts.\n"
    "Generating model: y = b + A/w * landau((x-mpv)/w), with unit-area mode-zero landau.\n"
    "Truth: b=0 V, A=150 V*keV, mpv=50 keV, w=5 keV (ROOT width convention).\n"
    "Independent Gaussian noise: sigma_i=0.025*(1+i/101) V; i=0..100.\n"
    f"NumPy PCG64 seed {SEED}; NumPy {np.__version__}, SciPy {scipy.__version__}.\n"
    "Generator: scripts/generate-landau-reference.py.\n"
    "Reference: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.landau.html\n"
    "Open landau.trksess for assigned uncertainties and starting values; or import the CSV,\n"
    "assign column 3 as Y uncertainty, enable advanced models, and select Landau peak.\n"
    "b starts fixed at zero. A is full-curve area, including the tail beyond these observations."
)
headers = ["Energy (keV)", "Signal (V)", "Y uncertainty (V)"]
table = [[format(v, '.17g') for v in row] for row in zip(x, y, sigma)]
csv = "\n".join("# " + line for line in notes.splitlines()) + "\n"
csv += ",".join(headers) + "\n" + "\n".join(",".join(row) for row in table) + "\n"
Path("examples/data/landau.csv").write_text(csv)

request = dict(
    format="tracker-fit-request", version=1,
    requestId="50aa0000-0000-4000-8000-000000000001",
    snapshotId="50aa0000-0000-4000-8000-000000000002",
    source=dict(application="Synthetic Landau example", version="2026-10-06", context=notes, fileName="landau.csv"),
    dataset=dict(id="synthetic-landau", label="Synthetic Landau peak",
                 xColumn=dict(id="x", label="Energy", unit="keV"),
                 yColumn=dict(id="y", label="Signal", unit="V"),
                 assumptions=dict(exactX="asserted", gaussianIndependent="asserted", correctModel="asserted"),
                 rows=[dict(id=f"landau-{i}", x=float(a), y=float(b), included=True, missingReason=None)
                       for i, (a, b) in enumerate(zip(x, y))]),
    uncertainty=dict(kind="supplied-per-row", errorStructure="uncorrelated",
                     sigmaByRow={f"landau-{i}": float(s) for i, s in enumerate(sigma)},
                     provenance=dict(kind="user-asserted", description="Known synthetic generating standard deviations")),
)
session = dict(
    format="tracker-fit-session", version=7, engine="qr-lm-3", request=request,
    settings=dict(model="landau", parameters=[dict(value=float(v), fixed=i == 0) for i, v in enumerate(initial)],
                  excludedIds=[], conditionalInference=False, physicalTimeConfirmed=False, selectionAfterInspection=False),
    workspace=dict(kind="single-fit"), view=dict(showResiduals=True, showGuides=True, showErrorBars=True),
)
Path("examples/data/landau.trksess").write_text(json.dumps(session, indent=2) + "\n")
print("Wrote Landau CSV, session, and numerical references.")
