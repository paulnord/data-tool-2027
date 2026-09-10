"""Deterministic synthetic classroom fixture; no runtime data generation."""
from pathlib import Path
import random

# Fixed seed preserves the exact example; independent Gaussian position errors.
SEED = 20260910
SIGMA_M = 0.003
rng = random.Random(SEED)
root = Path(__file__).resolve().parents[2]
lines = ["# Synthetic classroom data: two-object collision; time in seconds and positions in meters. Choose intervals away from t=2 s. Independent Gaussian position noise: sigma=0.003 m; seed=20260910.", "Time (s),x1 (m),y1 (m),x2 (m),y2 (m)"]
for i in range(41):
    t = i / 10
    start = [-1, .1, .8, .8]
    before = [.6, .15, -.3, -.2]
    after = [.1, -.2, .2, .15]
    values = [start[j] + before[j] * min(t, 2) + after[j] * max(0, t - 2) + rng.gauss(0, SIGMA_M) for j in range(4)]
    lines.append(f"{t:.1f}," + ",".join(f"{v:.6f}" for v in values))
(root / "examples/data/collision.csv").write_text("\n".join(lines) + "\n")
