#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d .tools/cargo ]]; then
  export CARGO_HOME="$PWD/.tools/cargo" RUSTUP_HOME="$PWD/.tools/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
if [[ -d .tools/node-v22.16.0-darwin-arm64/bin ]]; then
  export PATH="$PWD/.tools/node-v22.16.0-darwin-arm64/bin:$PATH"
fi
case "${1:-build}" in
 build)
  npx tauri icon src-tauri/icons/icon.svg
  npx tauri build --bundles app
  codesign --force --deep --sign - "src-tauri/target/release/bundle/macos/Data Tool 2027.app"
  codesign --verify --deep --strict "src-tauri/target/release/bundle/macos/Data Tool 2027.app"
  ;;
 dev) npx tauri dev ;;
 test|verify) cargo test --manifest-path src-tauri/Cargo.toml ;;
 *) echo "Usage: bash scripts/desktop.sh [build|dev|test|verify]"; exit 2 ;;
esac
