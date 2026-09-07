'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const read = (p) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');

/**
 * Shell source with comment lines removed.
 *
 * The script DOCUMENTS the flags it no longer uses, because explaining why
 * `--since-commit HEAD` and `--only-verified` were wrong is most of the value of
 * the comment. Asserting their absence against the raw file would therefore fail
 * on the explanation rather than on the code.
 *
 * @param {string} p - repo-relative path to read
 * @returns {string} the file with its comment lines removed
 */
const code = (p) =>
  read(p)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

describe('secret scan actually scans (REV-757)', () => {
  it('runs the shared script rather than an inline trufflehog invocation', () => {
    const script = JSON.parse(read('package.json')).scripts['security:secrets'];

    expect(script).toMatch(/scan-secrets\.sh/);
  });

  it('scans the staged content, not commits after HEAD', () => {
    // The defect itself. `--since-commit HEAD` scans commits AFTER HEAD: at
    // pre-commit there are none, and at pre-push HEAD is already the tip being
    // pushed. Real runs logged "chunks: 0, bytes: 0" — the gate reported
    // success on every commit while reading nothing.
    const script = code('scripts/scan-secrets.sh');

    expect(script).not.toMatch(/--since-commit/);
    expect(script).toMatch(/git show ":\$path"/);
    expect(script).toMatch(/trufflehog filesystem/);
    // Renames report as R; --diff-filter=ACM dropped them entirely, so
    // `git mv leaked.js other.js` presented no files to scan.
    expect(script).toMatch(/--diff-filter=ACMR/);
  });

  it('does not pass --only-verified, which suppressed everything unverifiable', () => {
    // Measured: with --only-verified a planted, non-example AWS key pair was
    // NOT detected even when the right content was scanned. It fails only on
    // credentials trufflehog can authenticate against the live service, so a
    // revoked key — or one for a service it has no verifier for — passed
    // silently.
    //
    // Scoped to the invocation, not the whole file: the failure message
    // deliberately names the flag to explain the choice to whoever trips the
    // gate, and that mention is not the flag being passed.
    const invocation = code('scripts/scan-secrets.sh')
      .split('\n')
      .filter((line) => line.includes('trufflehog '))
      .join('\n');

    expect(invocation).toMatch(/trufflehog filesystem/);
    expect(invocation).not.toMatch(/--only-verified/);
  });

  it('never hands a repository path to trufflehog, which breaks in a worktree', () => {
    // `trufflehog git file://<path>` reads `.git/index`, and in a git worktree
    // `.git` is a file rather than a directory, so it exits with "failed to
    // read index file". Reading staged blobs with `git show :path` resolves
    // correctly from any worktree, so the failure mode cannot arise.
    expect(code('scripts/scan-secrets.sh')).not.toMatch(/trufflehog\s+git\s+"?file:/);
  });

  it('is wired into the pre-commit hook, not merely defined', () => {
    // A scan script nothing invokes protects nothing. This repo's convention is
    // that every security:* script is reachable from a gate by name (see
    // gate-composition.test.js), so the hook calls it through npm.
    expect(read('.husky/pre-commit')).toMatch(/npm run security:secrets/);
  });

  it('does not gate CI on --only-verified either', () => {
    // The local gate and the CI job are independent scan paths. Fixing only the
    // local one leaves a committed unverifiable credential passing CI.
    const workflows = path.join(REPO_ROOT, '.github', 'workflows');
    const files = fs.existsSync(workflows) ? fs.readdirSync(workflows) : [];
    const withTrufflehog = files
      .map((f) => path.join(workflows, f))
      .filter((f) =>
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.readFileSync(f, 'utf8').toLowerCase().includes('trufflehog'),
      );

    // Strip YAML comments first: the workflow explains why the flag was
    // removed, and that explanation is not the flag being passed — the same
    // trap the shell assertions above avoid by dropping `#` lines.
    for (const file of withTrufflehog) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const yaml = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .join('\n');

      expect(yaml).not.toMatch(/--only-verified/);
    }
  });
});
