"""Ordinary synthetic classroom files; never imported by application code."""
import math, random
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'examples/data'
rng=random.Random(20260911)
rows=['# Synthetic classroom data: bounce with approach, spring-like contact and departure. Independent Gaussian position scatter sigma=0.00015 m; seed=20260911. Gravity omitted over this short interval. Select ranges yourself.','Time (s),Position (m)']
for i in range(161):
 t=i*.0005
 y=.1-2*t if t<.025 else .05-2/(math.pi/.02)*math.sin(math.pi*(t-.025)/.02) if t<=.045 else .05+2*(t-.045)
 rows.append(f'{t:.6f},{y+rng.gauss(0,.00015):.9f}')
(root/'bounce-intervals.csv').write_text('\n'.join(rows)+'\n')
rows=['# Synthetic classroom data: two carts on a one-dimensional track. Independent Gaussian position scatter sigma=0.003 m; seed=20260911. Select before and after intervals away from t=2 s.','Time (s),Cart 1 position (m),Cart 2 position (m)']
for i in range(81):
 t=i*.05
 a=-1+.6*min(t,2)+.1*max(0,t-2)
 b=.8-.3*min(t,2)+.2*max(0,t-2)
 rows.append(f'{t:.6f},{a+rng.gauss(0,.003):.8f},{b+rng.gauss(0,.003):.8f}')
(root/'cart-track.csv').write_text('\n'.join(rows)+'\n')
rows=['# Synthetic classroom data: one oil drop with three drift intervals; downward drift, upward motion, faster downward motion. Position increases upward. Transients omitted; this is not a charge measurement. Independent Gaussian scatter sigma=0.003 mm; seed=20260911.','Time (s),Drop position (mm)']
for i in range(181):
 t=i*.05
 y=.3-.03*min(t,3)+.05*min(max(0,t-3),3)-.07*max(0,t-6)
 rows.append(f'{t:.6f},{y+rng.gauss(0,.003):.8f}')
(root/'oil-drop-intervals.csv').write_text('\n'.join(rows)+'\n')
