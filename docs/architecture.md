# Architecture

- `src/core/fit/`: pure TypeScript numerical engine, strict schemas, source tables, uncertainty models, selections, model comparison, derived quantities, model guides and language-neutral code-export descriptions. No React, DOM, storage or native APIs.
- `src/import/`: bounded local Tracker XML/ZIP parsing and calibrated numerical snapshots; no video decoding, file writes or resource fetching.
- `src/fit/`: React analysis, comparison and data-table UI; workers run numerical fits. SVG graphs are shared with the print report. Reproducibility artifacts are packaged locally as ZIP archives.
- `src-tauri/`: small Rust host for local file dialogs, bounded reads, atomic text/binary exports, process launch arguments and acknowledgments. The system webview handles rendering and printing. No video dependencies or production test hooks.
- `examples/data/`: ordinary static CSV and session files, packaged as an Examples directory for the native file chooser.
- `tests/`: scientific tests, independent references and deterministic test-data generators.
- `e2e/`: fitting/data workflows and explicit empty-startup checks; no Tracker video tests.

New analyses have zero observations, unspecified units and unknown uncertainty/assumptions. Nothing is implicitly fitted. Imported sessions use the current v7 schema; invalid imports cannot replace the active analysis. Table edits and selection changes retain undo behavior. Labels/units never silently rescale values.

The application identity is `org.opensourcephysics.datatool2027`, independent of Tracker. The source tree, build artifacts, local toolchains and Git repository are independent; neither program's build writes into the other directory. Future Tracker integration uses the documented file-and-process boundary.
