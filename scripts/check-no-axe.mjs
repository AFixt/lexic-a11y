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

/** A tarball URL for the empty package the override aliases axe-core to. */
const EMPTY_TARBALL = /\/empty-npm-package\/-\//;

/*
 * The override leaves an entry keyed "axe-core" that npm records with
 * `"name": "empty-npm-package"` and an empty-npm-package tarball; that is the
 * intended state, not a violation.
 */
const isEmptyAlias = (entry) =>
  entry.name === 'empty-npm-package' || EMPTY_TARBALL.test(entry.resolved ?? '');

/*
 * An entry is axe if its install path, its real package name (which differs
 * from the path under an npm alias such as `"x": "npm:axe-core@4"`), or its
 * tarball says so.
 */
const isAxeEntry = (key, entry) =>
  isAxePackageName(packageNameFromLockKey(key)) ||
  isAxePackageName(entry.name ?? '') ||
  AXE_TARBALL.test(entry.resolved ?? '');

/*
 * Fails closed: every axe entry is a violation unless it is the empty alias.
 * Keying on a registry tarball URL instead would let a real axe-core through
 * whenever it is resolved from git or a local file, bundled inside another
 * package, or written without `resolved` (npm's omit-lockfile-registry-resolved).
 */
const findLockOffenders = (lock) =>
  Object.entries(lock.packages)
    .filter(([key, entry]) => key !== '' && isAxeEntry(key, entry) && !isEmptyAlias(entry))
    .map(([key, entry]) => ({ key, version: entry.version, resolved: entry.resolved }));

const isBannedName = (name) => BANNED_DIRECT.includes(name) || isAxePackageName(name);

/** The package an `npm:` alias spec points at, e.g. "npm:@axe-core/x@4" -> "@axe-core/x". */
const aliasTarget = (spec) => {
  if (typeof spec !== 'string' || !spec.startsWith('npm:')) return null;
  const target = spec.slice('npm:'.length);
  const at = target.indexOf('@', 1);
  return at === -1 ? target : target.slice(0, at);
};

/*
 * A direct dependency is a violation even if an override currently neutralises
 * it, because the intent is wrong and the override may be removed. That holds
 * under any name: `"my-axe": "npm:axe-core@4"` is axe-core.
 */
const findDeclared = (manifest) =>
  [
    ...Object.entries(manifest.dependencies ?? {}),
    ...Object.entries(manifest.devDependencies ?? {}),
    ...Object.entries(manifest.optionalDependencies ?? {}),
    ...Object.entries(manifest.peerDependencies ?? {}),
  ].flatMap(([name, spec]) => {
    if (isBannedName(name)) return [name];
    const target = aliasTarget(spec);
    return target !== null && isBannedName(target) ? [`${name} (${spec})`] : [];
  });

const report = (declared, offenders) => {
  console.error('axe-core is banned in this repository (see "axe-core is banned" in CLAUDE.md).\n');

  if (declared.length > 0) {
    console.error('Declared in package.json (remove it, then re-run `npm install`):');
    for (const name of declared) console.error(`  - ${name}`);
    console.error('');
  }

  if (offenders.length > 0) {
    console.error('Resolving to a real axe-core in package-lock.json:');
    for (const { key, version, resolved } of offenders) {
      console.error(`  - ${key} @ ${version}\n      ${resolved ?? '(no resolved field)'}`);
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

/*
 * Only the lockfileVersion 2/3 `packages` map is read. Without it there is no
 * evidence to check, and reporting the tree clean would be a false pass.
 */
if (typeof lock.packages !== 'object' || lock.packages === null) {
  console.error(
    `package-lock.json in ${ROOT} has no "packages" map (lockfileVersion ${lock.lockfileVersion ?? 'unknown'}); ` +
      'regenerate it with npm 7 or later.',
  );
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
