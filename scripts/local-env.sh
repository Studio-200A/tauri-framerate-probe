#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
probe_root="$PWD"
export CARGO_HOME="$probe_root/.cache/cargo"
export CARGO_TARGET_DIR="$probe_root/src-tauri/target"
export npm_config_cache="$probe_root/.cache/npm"
export XDG_CACHE_HOME="$probe_root/.cache/runtime"
export XDG_DATA_HOME="$probe_root/.cache/data"
export XDG_CONFIG_HOME="$probe_root/.cache/config"
export TMPDIR="$probe_root/.cache/tmp"
mkdir -p "$TMPDIR" "$XDG_CACHE_HOME" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME"
export PKG_CONFIG_PATH="$probe_root/.local-deps/root/usr/lib64/pkgconfig:$probe_root/.local-deps/root/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
export LIBRARY_PATH="$probe_root/.local-deps/root/usr/lib64${LIBRARY_PATH:+:$LIBRARY_PATH}"
export PKG_CONFIG_ALLOW_SYSTEM_LIBS=1
exec "$@"
