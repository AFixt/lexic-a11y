#!/usr/bin/env bash
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || return 1; }

echo "Checking required tools..."

if ! need node; then
  echo "Missing: node. Install via nvm using the version in .nvmrc."
  exit 1
fi

if ! need git; then
  echo "Missing: git."
  exit 1
fi

install_if_missing() {
  local cmd="$1"
  local brew_pkg="${2:-$1}"
  if ! need "$cmd"; then
    echo "Installing $cmd via brew..."
    if ! need brew; then
      echo "Homebrew not found. Install $cmd manually from its GitHub releases."
      return 1
    fi
    brew install "$brew_pkg"
  fi
}

install_if_missing semgrep
install_if_missing osv-scanner
install_if_missing trufflehog
install_if_missing lychee
install_if_missing actionlint
# actionlint checks `run:` scripts only when shellcheck is installed.
install_if_missing shellcheck

echo ""
echo "Installing npm dependencies..."
npm ci

echo ""
echo "All tools ready. Run 'npm run check:all' to verify."
