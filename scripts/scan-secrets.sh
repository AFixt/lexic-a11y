#!/usr/bin/env sh
# Secret scan over the content actually being committed.
#
# REV-757 (fleet rollout of REV-670): the previous gates in this repo scanned real
# content and then suppressed nearly everything they could find. Both passed
# `--only-verified`:
#
#   trufflehog git file://. --only-verified --fail          (npm run security:secrets)
#   trufflehog filesystem <staged paths> --only-verified    (.husky/pre-commit)
#
# `--only-verified` fails only on credentials trufflehog can authenticate against
# the live service, so a revoked key, or one for a service it has no verifier
# for, passed silently even though it was read. That is most of what a secret
# gate exists to catch.
#
# (The afixt-engine original of this script also fixed a `--since-commit HEAD`
# variant that scanned nothing at all — "chunks: 0, bytes: 0". This repo never
# ran that form; it is kept in the table below because the table was measured
# with it and the row still explains why the flag is wrong.)
#
# Measured in a scratch repo with a planted, NON-EXAMPLE AWS key pair:
#
#   git --since-commit HEAD --only-verified --fail   exit 0    not detected
#   git --since-commit HEAD --fail                   exit 0    not detected
#   git --only-verified --fail  (full history)       exit 0    not detected
#   git --fail                  (full history)       exit 183  DETECTED
#   filesystem <staged paths> --fail                 exit 183  DETECTED
#   filesystem <staged paths> --fail --only-verified exit 0    not detected
#
# (AKIAIOSFODNN7EXAMPLE is AWS's documentation key and is allowlisted by
# trufflehog. Using it as a fixture produces a false negative and nearly hid all
# of the above.)
#
# So this scans the STAGED PATHS as files and does not pass --only-verified. The
# cost is real — unverifiable high-entropy strings can trip it — but that is the
# right side to err on for a gate whose whole job is to stop a credential
# entering history, and scoping it to the files in the commit keeps the noise
# proportional to the change.
set -eu

command -v trufflehog >/dev/null 2>&1 || {
  echo "warn: trufflehog not installed — secret scanning skipped (brew install trufflehog)"
  exit 0
}

# Scan the STAGED BLOBS, not the working tree. Three reasons, two of which were
# holes in the first version of this fix and were found by probing it:
#
#   * Renames. A rename reports as R, and `--diff-filter=ACM` dropped it — so
#     `git mv leaked.js other.js` presented NO files to scan and the gate exited
#     0. ACMR includes it, and reading from the index gets the destination
#     content.
#   * A path staged and then deleted from the working tree still commits its
#     staged content, but there is no file left to read. The earlier version let
#     trufflehog error and still exited 0 — a scan error that looked clean.
#   * lint-staged runs before this and rewrites files, so the working tree is
#     not necessarily what is about to be committed. The index is.
#
# Reading the index also makes this worktree-safe: `trufflehog git file://.`
# fails inside a git worktree, where `.git` is a plain file rather than a
# directory, with "failed to read index file". `git show :path` resolves
# correctly from any worktree, so that failure mode cannot arise here.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

count=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  dest="$tmp/$path"
  mkdir -p "$(dirname "$dest")"
  # `git show :path` reads the staged blob. Fail closed: if a staged path
  # cannot be read, that is a reason to stop, not to continue quietly.
  if ! git show ":$path" > "$dest" 2>/dev/null; then
    echo "  secret scan: could not read staged content for '$path' — refusing to pass."
    exit 1
  fi
  count=$((count + 1))
done <<EOF
$(git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMR)
EOF
# `core.quotePath=false` matters: git otherwise octal-escapes and double-quotes
# any path with a non-ASCII byte (`"r\303\251sum\303\251.md"`), `git show`
# cannot resolve the quoted form, and the fail-closed branch above would refuse
# every commit that stages such a file — clean or not.

# Nothing staged is the normal case when this runs from `check:all` or
# `npm run security` rather than the pre-commit hook. Say so, so an exit 0 here
# is never mistaken for a clean scan of the repository.
if [ "$count" -eq 0 ]; then
  echo "secret scan: nothing staged — no content scanned (this gate scans the staged blobs; see scripts/scan-secrets.sh)."
  exit 0
fi

if ! trufflehog filesystem "$tmp" --fail --no-update; then
  echo ""
  echo "  Secret scan FAILED. The finding above is in content you are about to commit."
  echo "  Paths are reported under a temporary directory because the STAGED blobs are"
  echo "  scanned, not the working tree — strip the leading temp path to locate the file."
  echo ""
  echo "  Remove the credential and ROTATE it: it is compromised the moment it is written"
  echo "  down, and amending the commit does not un-leak it."
  echo ""
  echo "  Run it yourself with:  npm run security:secrets"
  echo "  If it is genuinely a false positive, see scripts/scan-secrets.sh for why"
  echo "  --only-verified is deliberately NOT used here."
  echo ""
  exit 1
fi
