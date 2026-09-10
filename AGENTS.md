# Data Tool 2027

Independent local-data fitting app extracted from Tracker 2027. Only modify this repository. Tracker and OSP repositories are read-only references.

TypeScript scientific core in src/core/fit is independent of UI and native APIs. Preserve exact observations, explicit units, uncertainty assumptions, rank diagnostics and immutable state. No video engine, network service or telemetry. Default startup is an empty table. Examples are ordinary files opened through the file chooser; never add example-selection menus to either window. Unit entry is case-sensitive: disable capitalization, autocorrection, spell-checking and autocomplete. Preserve symbols such as m and mH exactly as typed.

Keep the versioned tracker-fit-request/session/ack v1 protocol and .trksess compatibility until a documented migration supersedes them. See docs/integration.md; the five nonlinear model additions use the documented session v2 migration while requests and acknowledgments stay v1. Validate before import/save; failed imports preserve work.

Run npm test, npm run build, npm run test:e2e. Native host changes also require npm run test:desktop. No production smoke harnesses. Do not configure a remote or push without authorization.
