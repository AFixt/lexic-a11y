#!/usr/bin/env node
/**
 * Fails if axe-core can resolve anywhere in this project's dependency tree (#158).
 *
 * axe-core is banned in this repository (see "axe-core is banned" in
 * CLAUDE.md), directly and transitively. package.json carries an override that
 * redirects any axe-core request to an empty package, but an override is easy
 * to drop by accident during a dependency bump, and it only covers the package
 * named `axe-core` — a new dependency on `@axe-core/playwright` or `jest-axe`
 * would not be caught at all. This check makes either a build failure instead
 * of a silent regression.
 *
 * It reads package-lock.json and package.json rather than running `npm ls`, so
 * it needs no network and no installed node_modules. That is what separates it
 * from `security:banned-deps` (scripts/check-banned-deps.mjs), which walks the
 * *installed* tree to name the dependency chain that requested a banned
 * package. Both run; they fail on different evidence.
 *
 * Usage:
 *   node scripts/check-no-axe.mjs [project-root]
 *
 * With no argument it checks this repository, which is how `check:no-axe`
 * invokes it. With one, it checks that directory instead — the path the tests
 * drive.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..'));

/** Banned as direct dependencies, in addition to anything under @axe-core/. */
const BANNED_DIRECT = [
  'axe-core',
  'jest-axe',
  '@types/jest-axe',
  'vitest-axe',
  'cypress-axe',
  'axe-playwright',
  'axe-puppeteer',
];

/** The override that neutralises any transitive axe-core request. */
const OVERRIDE_TARGET = 'npm:empty-npm-package@1.0.0';

/** A tarball URL for axe-core itself or any @axe-core/* package. */
const AXE_TARBALL = /\/(?:@axe-core\/[^/]+|axe-core)\/-\//;

const isAxePackageName = (name) => name === 'axe-core' || name.startsWith('@axe-core/');

/** The last path segment of a node_modules key, e.g. "a/node_modules/b" -> "b". */
const packageNameFromLockKey = (key) => {
  const marker = 'node_modules/';
  const index = key.lastIndexOf(marker);
  return index === -1 ? key : key.slice(index + marker.length);
};

/** Parse one of the two fixed manifest filenames under ROOT. Read-only. */
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));

/*
 * An entry is only a real axe-core if it actually resolves to an axe tarball.
 * The override leaves an entry keyed "axe-core" that resolves to
 * empty-npm-package; that is the intended state, not a violation.
 */
const findLockOffenders = (lock) =>
  Object.entries(lock.packages ?? {})
    .filter(([key]) => key !== '' && isAxePackageName(packageNameFromLockKey(key)))
    .filter(([, entry]) => AXE_TARBALL.test(entry.resolved ?? ''))
    .map(([key, entry]) => ({ key, version: entry.version, resolved: entry.resolved }));

/*
 * A direct dependency is a violation even if an override currently neutralises
 * it, because the intent is wrong and the override may be removed.
 */
const findDeclared = (manifest) =>
  [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ].filter((name) => BANNED_DIRECT.includes(name) || isAxePackageName(name));

const report = (declared, offenders) => {
  console.error('axe-core is banned in this repository (see "axe-core is banned" in CLAUDE.md).\n');

  if (declared.length > 0) {
    console.error('Declared in package.json (remove it, then re-run `npm install`):');
    for (const name of declared) console.error(`  - ${name}`);
    console.error('');
  }

  if (offenders.length > 0) {
    console.error('Resolving to a real axe tarball in package-lock.json:');
    for (const { key, version, resolved } of offenders) {
      console.error(`  - ${key} @ ${version}\n      ${resolved}`);
    }
    console.error(
      '\nRestore the override in package.json:\n' +
        `  "overrides": { "axe-core": "${OVERRIDE_TARGET}" }\n` +
        'then re-run `npm install`. If an @axe-core/* package is listed, remove ' +
        'the dependency that pulls it in — the override does not cover it.',
    );
  }
};

let lock;
let manifest;
try {
  lock = readJson('package-lock.json');
  manifest = readJson('package.json');
} catch (error) {
  console.error(`Could not read package.json or package-lock.json in ${ROOT}: ${error.message}`);
  process.exit(2);
}

const offenders = findLockOffenders(lock);
const declared = findDeclared(manifest);

if (offenders.length === 0 && declared.length === 0) {
  console.log('OK: axe-core does not resolve anywhere in the dependency tree.');
  process.exit(0);
}

report(declared, offenders);
process.exit(1);
