/**
 * Tests for the axe-core ban guard (scripts/check-no-axe.mjs, #158).
 *
 * The guard is only worth having if it fails, so these pin both directions:
 * the real tree passes, and each way axe-core could come back — a lockfile
 * entry resolving to a real axe tarball, or a banned direct dependency —
 * fails. The script runs as a child process, so the exit code observed here is
 * the one `npm run check` and the pre-push hook act on.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'check-no-axe.mjs');
const EMPTY = 'https://registry.npmjs.org/empty-npm-package/-/empty-npm-package-1.0.0.tgz';
const REAL = 'https://registry.npmjs.org/axe-core/-/axe-core-4.10.0.tgz';
const OVERRIDES = { 'axe-core': 'npm:empty-npm-package@1.0.0' };

/**
 * Run the guard against a project directory.
 *
 * @param {string} [dir] Project root to check; this repository when omitted.
 * @returns {{status: number | null, output: string}} Exit code and combined output.
 */
function run(dir) {
  const args = dir ? [SCRIPT, dir] : [SCRIPT];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/**
 * Write a fixture project (package.json + package-lock.json) and run the guard on it.
 *
 * @param {object} manifest The package.json contents.
 * @param {object} packages The package-lock.json `packages` map.
 * @returns {{status: number | null, output: string}} Exit code and combined output.
 */
function runFixture(manifest, packages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-no-axe-'));
  try {
    // The paths are inside a fresh mkdtemp directory this test just created.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ packages }));
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('check-no-axe', () => {
  it('passes on this repository as it stands', () => {
    const { status, output } = run();

    expect(output).toContain('OK: axe-core does not resolve anywhere in the dependency tree.');
    expect(status).toBe(0);
  });

  it('fails when a lockfile axe-core entry resolves to the real axe tarball', () => {
    const { status, output } = runFixture(
      { overrides: OVERRIDES },
      { '': {}, 'node_modules/axe-core': { version: '4.10.0', resolved: REAL } },
    );

    expect(status).toBe(1);
    expect(output).toContain('node_modules/axe-core @ 4.10.0');
    expect(output).toContain('"axe-core": "npm:empty-npm-package@1.0.0"');
  });

  it('passes when the axe-core entry is aliased to empty-npm-package (the override working)', () => {
    const { status } = runFixture(
      { overrides: OVERRIDES },
      { '': {}, 'node_modules/axe-core': { version: '1.0.0', resolved: EMPTY } },
    );

    expect(status).toBe(0);
  });

  it('fails on a nested @axe-core/* lockfile entry resolving to a real tarball', () => {
    const { status, output } = runFixture(
      { overrides: OVERRIDES },
      {
        '': {},
        'node_modules/some-tool/node_modules/@axe-core/playwright': {
          version: '4.10.0',
          resolved: 'https://registry.npmjs.org/@axe-core/playwright/-/playwright-4.10.0.tgz',
        },
      },
    );

    expect(status).toBe(1);
    expect(output).toContain('node_modules/some-tool/node_modules/@axe-core/playwright @ 4.10.0');
  });

  it('fails when package.json declares @axe-core/playwright as a devDependency, installed or not', () => {
    const { status, output } = runFixture(
      { overrides: OVERRIDES, devDependencies: { '@axe-core/playwright': '^4.10.0' } },
      { '': {} },
    );

    expect(status).toBe(1);
    expect(output).toContain('  - @axe-core/playwright');
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'])(
    'fails on every named axe wrapper declared in %s',
    (field) => {
      const wrappers = [
        'axe-core',
        'jest-axe',
        '@types/jest-axe',
        'vitest-axe',
        'cypress-axe',
        'axe-playwright',
        'axe-puppeteer',
      ];
      const { status, output } = runFixture(
        { [field]: Object.fromEntries(wrappers.map((name) => [name, '*'])) },
        { '': {} },
      );

      expect(status).toBe(1);
      for (const name of wrappers) expect(output).toContain(`  - ${name}\n`);
    },
  );
});
