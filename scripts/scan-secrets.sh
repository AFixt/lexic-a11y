#!/usr/bin/env sh
# Secret scan over the content actually being committed.
#
# REV-757 / REV-670: the previous version of this gate reported success on every
# commit because it scanned nothing:
#
#   trufflehog git file://. --since-commit HEAD --only-verified --fail
#
# Two independent problems, each sufficient on its own.
#
#   1. `--since-commit HEAD` scans commits AFTER HEAD. At pre-commit the content
#      is staged and not yet committed, so there are none; at pre-push HEAD is
#      already the tip being pushed, so again none. The tell was in the output
#      all along — real runs logged "chunks: 0, bytes: 0", meaning it never read
#      the repository.
#   2. `--only-verified` fails only on credentials trufflehog can authenticate
#      against the live service, so a revoked key, or one for a service it has
#      no verifier for, passes silently even when scanned.
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
$(git diff --cached --name-only --diff-filter=ACMR)
EOF

[ "$count" -gt 0 ] || exit 0

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
