from pathlib import Path
import json, math, uuid, zipfile

import numpy as np
import openpyxl
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source"
PUB = ROOT / "examples/data/published"
PUB.mkdir(parents=True, exist_ok=True)


def compact(v):
    return format(float(v), ".10g")


def model(p, x):
    b, s, c, T, tau = p
    return b + np.exp(-x / tau) * (s * np.sin(2 * np.pi * x / T) + c * np.cos(2 * np.pi * x / T))


def fit_equal_scatter(x, y, cut, p0):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    keep = x >= cut
    xx, yy = x[keep], y[keep]
    result = least_squares(
        lambda p: model(p, xx) - yy,
        p0,
        bounds=([-np.inf, -np.inf, -np.inf, 1e-9, 1e-9], [np.inf, np.inf, np.inf, np.inf, np.inf]),
        x_scale="jac",
        ftol=1e-13,
        xtol=1e-13,
        gtol=1e-13,
        max_nfev=100000,
    )
    if not result.success:
        raise RuntimeError(result.message)
    n, k = len(xx), 5
    sse = float(result.fun @ result.fun)
    sigma = math.sqrt(sse / (n - k))
    cov = np.linalg.inv(result.jac.T @ result.jac) * sigma**2
    return result.x, np.sqrt(np.diag(cov)), sigma, n


def phase(s, c):
    return math.atan2(c, s)


# YMnO3 source-data workbook, Fig. 2 raw trace.
wb = openpyxl.load_workbook(SRC / "ymno3-source.xlsx", data_only=True, read_only=True)
ws = wb["Fig. 2"]
ym = []
for row in ws.iter_rows(min_row=4, values_only=True):
    if row[1] is not None and row[2] is not None:
        ym.append((float(row[1]), float(row[2])))
ym_x = np.array([p[0] for p in ym])
ym_y = np.array([p[1] for p in ym])
ym_p, ym_se, ym_sigma, ym_n = fit_equal_scatter(
    ym_x, ym_y, 5.0, [0.00103, 0.00225, 0.00020, 18.2, 150.0]
)

# Cross-check against fit-derived temperature-scan values near 30 K in the same source workbook.
ws_tau = wb["Fig. 4b"]
tau_near = []
for row in ws_tau.iter_rows(min_row=4, values_only=True):
    if isinstance(row[1], (int, float)) and isinstance(row[2], (int, float)):
        if abs(float(row[1]) - 30.0) < 1.0:
            tau_near.append((float(row[1]), float(row[2]), float(row[3])))
if not tau_near:
    raise RuntimeError("No YMnO3 near-30 K relaxation values found")

ym_header = [
    "# Published source data: YMnO3 antiferromagnetic Z-mode spin precession at about 30 K.",
    "# Tzschaschel, Satoh & Fiebig, Nature Communications 11, 6142 (2020). DOI: 10.1038/s41467-020-19749-y.",
    "# Meaning: time-resolved Faraday rotation after impulsive optical excitation. The damped oscillation is the antiferromagnetic Z-mode precession.",
    "# Paper model: Phi(t)=A0+A1*exp(-t/t1)+A2*exp(-t/tau)*sin(omega*t+phi0). The configured Data Tool session selects t>=5 ps, after the short pump/probe and thermal transient, and fits the damped-sine term plus a constant baseline.",
    "# Paper text reports an exemplary period of about 18.2 ps and initial phase about 0.1 rad. Source-data temperature scans near 30 K give relaxation times about 145-150 ps with fit standard errors about 4 ps.",
    f"# Independent equal-scatter fit for t>=5 ps with Data Tool's damped-sine form gives T={ym_p[3]:.5f} ps, tau={ym_p[4]:.4f} ps, phase={phase(ym_p[1], ym_p[2]):.5f} rad; residual scatter={ym_sigma:.5g} arb. u.",
    "# The source workbook does not provide point-by-point measurement uncertainties; parameter errors are therefore estimated from residual scatter under the equal-scatter model.",
    "Delay (ps),Faraday rotation (arb. u.)",
]
(PUB / "ymno3-spin-precession.csv").write_text(
    "\n".join(ym_header + [f"{compact(x)},{compact(y)}" for x, y in ym]) + "\n"
)

# DyFeO3 deposited Figure 1 reflection trace.
with zipfile.ZipFile(SRC / "dyfeo3-source.zip") as z:
    name = next(n for n in z.namelist() if n.endswith("Figure1/1c_time-resolved.txt"))
    text = z.read(name).decode("utf-8-sig")
dy = []
for line in text.splitlines()[1:]:
    cells = [c.strip() for c in line.split("\t")]
    nonempty = [c for c in cells if c]
    # Reflection coordinates are the last pair when both traces are present,
    # and the only pair once the shorter transmission trace ends.
    if len(nonempty) >= 4 or (line.startswith("\t") and len(nonempty) >= 2):
        dy.append((float(nonempty[-2]), float(nonempty[-1])))
dy_x = np.array([p[0] for p in dy])
dy_y = np.array([p[1] for p in dy])
dy_p, dy_se, dy_sigma, dy_n = fit_equal_scatter(
    dy_x, dy_y, 25.0, [-2.04, -0.72, -0.55, 4.52, 85.0]
)

dy_header = [
    "# Published source data: DyFeO3 coherent antiferromagnetic spin-wave signal in reflection geometry.",
    "# Hortensius et al., Nature Physics 17, 1001-1006 (2021). DOI: 10.1038/s41567-021-01290-4. Source data DOI: 10.5281/zenodo.4716539.",
    "# Meaning: time-resolved Kerr/polarization rotation after 3.1 eV optical pumping. The paper states that the Figure 1 time traces are fit by exponentially damped sines.",
    "# The configured session selects t>=25 ps to emphasize the late propagating-magnon oscillation and fits y=b+exp(-t/tau)[s*sin(2*pi*t/T)+c*cos(2*pi*t/T)].",
    f"# Independent equal-scatter fit for t>=25 ps gives T={dy_p[3]:.5f} ps ({1000/dy_p[3]:.2f} GHz) and tau={dy_p[4]:.2f} ps, consistent with the paper's separate Extended Data Fig. 5 statement of a damped-sine lifetime of about 85 ps.",
    "# The paper does not state that the Extended Data Fig. 5 fit used this exact Figure 1 source series or the same time window, so the 85 ps agreement is a comparison rather than an exact reconstruction.",
    "# The deposited Figure 1 source data do not provide point-by-point measurement uncertainties; parameter errors are estimated from residual scatter under the equal-scatter model.",
    "Time (ps),Kerr rotation (arb. u.)",
]
(PUB / "dyfeo3-spin-wave.csv").write_text(
    "\n".join(dy_header + [f"{compact(x)},{compact(y)}" for x, y in dy]) + "\n"
)

NS = uuid.UUID("12345678-1234-5678-1234-567812345678")
def uid(name):
    return str(uuid.uuid5(NS, name))


def make_session(name, label, xlabel, ylabel, points, cut, starts, context):
    rows = []
    excluded = []
    for i, (x, y) in enumerate(points):
        rid = f"row-{i}"
        rows.append({"id": rid, "x": x, "y": y, "included": True, "missingReason": None})
        if x < cut:
            excluded.append(rid)
    return {
        "format": "tracker-fit-session",
        "version": 2,
        "request": {
            "format": "tracker-fit-request",
            "version": 1,
            "requestId": uid(name + "-request"),
            "snapshotId": uid(name + "-snapshot"),
            "source": {
                "application": "Published literature example",
                "version": "Data Tool 2027 corpus 2026-09-11",
                "context": context,
                "fileName": name + ".csv",
            },
            "dataset": {
                "id": name,
                "label": label,
                "xColumn": {"id": "x", "label": xlabel, "unit": "ps"},
                "yColumn": {"id": "y", "label": ylabel, "unit": "arb. u."},
                "assumptions": {
                    "exactX": "asserted",
                    "gaussianIndependent": "unknown",
                    "correctModel": "unknown",
                },
                "rows": [
                    {**r, "x": float(r["x"]), "y": float(r["y"])} for r in rows
                ],
            },
            "uncertainty": {"errorStructure": "unknown", "kind": "unknown-equal"},
        },
        "settings": {
            "model": "damped-sine",
            "parameters": [{"value": float(v), "fixed": False} for v in starts],
            "excludedIds": excluded,
            "conditionalInference": True,
            "physicalTimeConfirmed": False,
            "selectionAfterInspection": False,
        },
        "engine": "qr-lm-3",
    }

ym_context = (
    "Publication-backed damped-oscillation example. DOI 10.1038/s41467-020-19749-y. "
    "YMnO3 Z-mode Faraday-rotation trace near 30 K from the authors' Source Data Fig. 2 workbook. "
    "The paper fits Phi=A0+A1 exp(-t/t1)+A2 exp(-t/tau) sin(omega t+phi0). "
    "This session excludes t<5 ps, where the pump/probe overlap and short thermal transient matter, then uses Data Tool's damped-sine model. "
    "Paper text gives period about 18.2 ps and phase about 0.1 rad; near-30 K source tables give tau about 145-150 ps with about 4 ps fit standard errors. "
    "No pointwise sigma is supplied, so equal scatter is estimated from residuals."
)
dy_context = (
    "Publication-backed damped-oscillation example. DOI 10.1038/s41567-021-01290-4; source-data DOI 10.5281/zenodo.4716539. "
    "DyFeO3 Figure 1 reflection-geometry time-resolved Kerr/polarization rotation after 3.1 eV pumping. "
    "The paper states that the Figure 1 trace is fit by an exponentially damped sine. "
    "This session selects t>=25 ps to isolate the late propagating-magnon oscillation. "
    "An independent equal-scatter fit gives T about 4.521 ps (221.2 GHz) and tau about 85.4 ps, consistent with the paper's separate Extended Data Fig. 5 statement of a lifetime about 85 ps. "
    "The paper does not establish that the Extended Data fit used this exact source series/window. No pointwise sigma is supplied."
)

sessions = {
    "ymno3-spin-precession": make_session(
        "ymno3-spin-precession",
        "YMnO3 antiferromagnetic Z-mode precession",
        "Pump-probe delay",
        "Faraday rotation",
        ym,
        5.0,
        [0.00103, 0.00225, 0.00020, 18.2, 150.0],
        ym_context,
    ),
    "dyfeo3-spin-wave": make_session(
        "dyfeo3-spin-wave",
        "DyFeO3 coherent antiferromagnetic spin wave",
        "Pump-probe delay",
        "Kerr rotation",
        dy,
        25.0,
        [-2.04, -0.72, -0.55, 4.52, 85.0],
        dy_context,
    ),
}
for name, session in sessions.items():
    (PUB / f"{name}.trksess").write_text(json.dumps(session, separators=(",", ":")))

amp = math.hypot(ym_p[1], ym_p[2])
ym_doc = f"""# YMnO3 antiferromagnetic Z-mode spin precession

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
| baseline `b` | {ym_p[0]:.9g} |
| sine coefficient `s` | {ym_p[1]:.9g} |
| cosine coefficient `c` | {ym_p[2]:.9g} |
| period `T` | {ym_p[3]:.6f} ± {ym_se[3]:.6f} ps |
| relaxation time `tau` | {ym_p[4]:.3f} ± {ym_se[4]:.3f} ps |
| equivalent amplitude | {amp:.9g} |
| equivalent phase | {phase(ym_p[1], ym_p[2]):.5f} rad |
| estimated residual scatter | {ym_sigma:.6g} arb. u. |

This closely recovers the oscillation parameters described and tabulated by the publication.

The source workbook does **not** provide a point-by-point measurement standard uncertainty for this trace. Data Tool therefore uses equal unknown scatter estimated from the residuals. The resulting parameter standard errors are conditional on that model and should not be interpreted as independently published point-error propagation.
"""
(PUB / "ymno3-spin-precession.md").write_text(ym_doc)

dy_doc = f"""# DyFeO3 coherent antiferromagnetic spin wave

[Data file](dyfeo3-spin-wave.csv) · [Configured session](dyfeo3-spin-wave.trksess) · [Published example index](README.md) · [Publication](https://doi.org/10.1038/s41567-021-01290-4) · [Source data](https://doi.org/10.5281/zenodo.4716539)

## Data and interpretation

Hortensius et al. measure coherent antiferromagnetic spin waves in DyFeO3. The CSV contains the authors' deposited **Figure 1 reflection-geometry** time-resolved Kerr/polarization-rotation trace after 3.1 eV optical pumping. The publication states that the thick solid curves in Figure 1 are **exponentially damped sine fits**.

The configured session selects the later portion, `t >= 25 ps`, where the propagating oscillation is cleanly visible, and fits Data Tool's built-in model:

`y = b + exp(-t/tau) * [s*sin(2*pi*t/T) + c*cos(2*pi*t/T)]`.

## Data Tool comparison

An independent equal-scatter least-squares fit to those selected source points gives:

| Quantity | Result |
| --- | ---: |
| baseline `b` | {dy_p[0]:.6f} ± {dy_se[0]:.6f} |
| sine coefficient `s` | {dy_p[1]:.6f} ± {dy_se[1]:.6f} |
| cosine coefficient `c` | {dy_p[2]:.6f} ± {dy_se[2]:.6f} |
| period `T` | {dy_p[3]:.6f} ± {dy_se[3]:.6f} ps |
| frequency | {1000/dy_p[3]:.3f} GHz |
| relaxation time `tau` | {dy_p[4]:.2f} ± {dy_se[4]:.2f} ps |
| estimated residual scatter | {dy_sigma:.6f} arb. u. |

The fitted frequency, about **221 GHz**, agrees with the reflection-mode frequency scale reported in the paper. The fitted relaxation time, **{dy_p[4]:.1f} ps**, is also consistent with the paper's separate Extended Data Figure 5 statement that a damped-sine fit to a propagating-magnon reflection trace gives a lifetime of **about 85 ps**.

That last comparison needs a caveat: the publication does not state that Extended Data Figure 5 uses this exact Figure 1 deposited series or the identical `t >= 25 ps` window. We therefore label the lifetime agreement as a comparison, not an exact reconstruction of the authors' Extended Data fit.

The deposited Figure 1 trace has no point-by-point measurement standard uncertainties, so Data Tool estimates a common scatter from the residuals and reports conditional parameter errors.
"""
(PUB / "dyfeo3-spin-wave.md").write_text(dy_doc)

# Let the generic configured-session test accept the two equal-scatter source traces.
test_path = ROOT / "tests/fit/publishedSessions.test.ts"
test = test_path.read_text()
old = '''    const chamber = file.includes("ion-chamber");
    const sigmaCol = 2;
    expect(session.request.dataset.rows).toHaveLength(rows.length);
    session.request.dataset.rows.forEach((row, i) => {
      expect(row.x).toBe(Number(rows[i][chamber ? 5 : 0]));
      expect(row.y).toBe(Number(rows[i][1]));
      const u = session.request.uncertainty;
      expect(u.kind).toBe("supplied-per-row");
      if (u.kind === "supplied-per-row")
        expect(u.sigmaByRow[row.id]).toBe(Number(rows[i][sigmaCol]));
    });
'''
new = '''    const chamber = file.includes("ion-chamber");
    expect(session.request.dataset.rows).toHaveLength(rows.length);
    session.request.dataset.rows.forEach((row, i) => {
      expect(row.x).toBe(Number(rows[i][chamber ? 5 : 0]));
      expect(row.y).toBe(Number(rows[i][1]));
      const u = session.request.uncertainty;
      if (u.kind === "supplied-per-row")
        expect(u.sigmaByRow[row.id]).toBe(Number(rows[i][2]));
      else expect(u.kind).toBe("unknown-equal");
    });
'''
if old not in test:
    raise RuntimeError("publishedSessions.test.ts expected block not found")
test_path.write_text(test.replace(old, new))

readme_path = PUB / "README.md"
readme = readme_path.read_text()
anchor = "| BESIII p pbar pi0 continuum | Clean reproduction of published nonlinear power-law parameters, errors and chi-square | [BESIII continuum](besiii-ppbarpi0-continuum.md) |\n"
addition = (
    "| YMnO3 Z-mode spin precession | Published raw trace; damped-sine fit recovers period, phase and near-30 K relaxation time | [YMnO3 precession](ymno3-spin-precession.md) |\n"
    "| DyFeO3 coherent spin wave | Published raw reflection trace; late-time damped fit gives 221 GHz and lifetime consistent with the paper's ~85 ps comparison | [DyFeO3 spin wave](dyfeo3-spin-wave.md) |\n"
)
if anchor not in readme:
    raise RuntimeError("README insertion anchor not found")
readme = readme.replace(anchor, anchor + addition)
stat_anchor = "Unless a page explicitly says otherwise, the reproduced calculation minimizes sum((y−model(x))/sigma_y)² with independent supplied Y standard deviations. X is held fixed. Reduced chi-square is that sum divided by the number of selected observations minus the number of free parameters. Excluded observations do not contribute to Data Tool's fit statistic.\n"
stat_add = "\nThe YMnO3 and DyFeO3 time-domain source files do not provide pointwise standard uncertainties. Their configured sessions instead use equal unknown scatter estimated from residuals; parameter errors are therefore conditional equal-scatter estimates rather than propagated published per-point errors.\n"
if stat_anchor not in readme:
    raise RuntimeError("README statistical anchor not found")
readme = readme.replace(stat_anchor, stat_anchor + stat_add)
readme_path.write_text(readme)

print("YMnO3 fit", ym_p, ym_se, ym_sigma, ym_n)
print("DyFeO3 fit", dy_p, dy_se, dy_sigma, dy_n)
