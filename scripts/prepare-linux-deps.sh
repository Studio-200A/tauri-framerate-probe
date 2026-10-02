#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local-deps/rpms .local-deps/root .cache/dnf
# Download/extract only: never install RPMs or execute their scripts.
dnf --setopt=cachedir="$PWD/.cache/dnf" \
  --setopt=persistdir="$PWD/.cache/dnf-persist" \
  --setopt=logdir="$PWD/.cache/dnf-log" \
  download --resolve --arch=x86_64 --destdir="$PWD/.local-deps/rpms" gtk3-devel webkit2gtk4.1-devel
python3 scripts/extract-deps.py
bash scripts/local-env.sh pkg-config --modversion gtk+-3.0 webkit2gtk-4.1
