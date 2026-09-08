import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..', '..');
const read = (p) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');

/**
 * Source with comment lines removed.
 *
 * Both the shell script and the workflow DOCUMENT the flags they no longer use,
 * because explaining why `--only-verified` was wrong is most of the value of the
 * comment. Asserting its absence against the raw file would therefore fail on
 * the explanation rather than on the code.
 *
 * @param {string} p - repo-relative path to read
 * @returns {string} the file with its `#` comment lines removed
 */
const code = (p) =>
  read(p)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/**
 * The trufflehog invocation(s) in a shell source, with backslash continuations
 * joined first so a flag on a wrapped line is still part of the command it
 * belongs to. Without the join, `trufflehog filesystem "$tmp" \` followed by
 * `--only-verified ...` on the next line would slip past a per-line filter.
 *
 * @param {string} p - repo-relative path to read
 * @returns {string} only the lines that invoke trufflehog
 */
const invocations = (p) =>
  code(p)
    .replaceAll(/\\\n\s*/g, ' ')
    .split('\n')
    .filter((line) => line.includes('trufflehog '))
    .join('\n');

describe('secret scan actually scans (REV-757)', () => {
  it('runs the shared script rather than an inline trufflehog invocation', () => {
    const script = JSON.parse(read('package.json')).scripts['security:secrets'];

    expect(script).toMatch(/scan-secrets\.sh/);
  });

  it('scans the staged blobs from the index', () => {
    // The gate this replaced scanned the WORKING-TREE copies of the staged
    // paths. lint-staged runs first and rewrites files, and a path staged then
    // deleted has no file left to read, so the working tree is not what is
    // about to be committed — the index is. `--since-commit HEAD` is asserted
    // absent too: it scans commits AFTER HEAD, i.e. nothing at pre-commit, and
    // is the form that muted the afixt-engine original of this script.
    const script = code('scripts/scan-secrets.sh');

    expect(script).not.toMatch(/--since-commit/);
    expect(script).toMatch(/git show ":\$path"/);
    expect(script).toMatch(/trufflehog filesystem/);
    // Renames report as R; --diff-filter=ACM dropped them entirely, so
    // `git mv leaked.js other.js` presented no files to scan.
    expect(script).toMatch(/--diff-filter=ACMR/);
    // git octal-escapes and quotes non-ASCII paths by default; `git show` cannot
    // resolve the quoted form, so without this every commit that stages e.g.
    // `résumé.md` is refused by the fail-closed branch.
    expect(script).toMatch(/git -c core\.quotePath=false diff --cached/);
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
    const invocation = invocations('scripts/scan-secrets.sh');

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
    // A scan script nothing invokes protects nothing. The hook calls it through
    // npm so the gate is reachable by the same name a developer would run.
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

    expect(withTrufflehog.length).toBeGreaterThan(0);

    // Strip YAML comments first: the workflow explains why the flag was
    // removed, and that explanation is not the flag being passed — the same
    // trap the shell assertions above avoid by dropping `#` lines.
    for (const file of withTrufflehog) {
      expect(code(path.relative(REPO_ROOT, file))).not.toMatch(/--only-verified/);
    }
  });
});
