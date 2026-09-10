"""Black-box release protocol test: no production test hooks or injected data."""
import json, subprocess, tempfile, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
app=root/'src-tauri/target/release/bundle/macos/Data Tool 2027.app/Contents/MacOS/data-tool-2027'
with tempfile.TemporaryDirectory(prefix='data-tool-integration-') as tmp:
 for fixture,expected in [('synthetic-request.json','accepted'),('synthetic-session.trksess','accepted'),('nonlinear-session-v2.trksess','accepted'),('custom-session-v3.trksess','accepted'),('invalid-extra-field.json','error')]:
  ack=Path(tmp)/(fixture+'.ack.json')
  process=subprocess.Popen([str(app),'--open',str(root/'examples/fit'/fixture),'--ack',str(ack)])
  try:
   deadline=time.monotonic()+45
   while not ack.exists() and process.poll() is None and time.monotonic()<deadline: time.sleep(.1)
   assert ack.exists(), f'No acknowledgment for {fixture}, process={process.poll()}'
   result=json.loads(ack.read_text()); assert result['status']==expected,result
   assert result['format']=='tracker-fit-ack' and result['version']==1,result
   original=json.loads((root/'examples/fit'/fixture).read_text())
   assert result['requestId']==original.get('request',original)['requestId'],result
   print(f'PASS {fixture}: {result["status"]}',flush=True)
  finally:
   if process.poll() is None:
    process.terminate()
    try: process.wait(timeout=5)
    except subprocess.TimeoutExpired: process.kill();process.wait()
