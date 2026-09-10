# Independent extraction — 2026-09-09

Source: `/Users/pnord/tracker-2027-work/tracker-2027`, including the working-tree fitting implementation. Its HEAD at extraction was `0d8aa63e3c76d4055f13dc74f9e568fd6620f800`; fitting work also existed outside that commit. The source repository, its Git metadata, remotes and working files were not altered by this extraction.

Only fitting UI/core, fitting tests/references, curated examples, compatibility schemas and license were copied. Video UI, browser/media abstractions, canonical trajectory/calibration modules, native decoder, FFmpeg resources, video fixtures and video tests were excluded. The native host was replaced with a fitting-only host. The old Tracker icon was replaced by a plot icon. No old Git history or remote configuration was copied.

Synthetic data generation moved to test support. Release startup uses a separately tested empty request; examples are optional static files. Existing v1 protocol tags and `.trksess` extension deliberately remain compatible; this is not a silent file-format migration. This directory begins a new Git repository without a remote or a push.

Verification: 82 scientific tests, all 47 browser workflows and three native host tests passed. Three black-box release launches accepted an existing Tracker request/session and rejected an invalid request with matching acknowledgment UUIDs. The final Mac bundle is approximately 10 MB. Production source/assets were checked for video-frame commands, synthetic generators and smoke-harness imports; none remain. macOS document association and physical printing still require manual installation/printer checks.
