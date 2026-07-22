#!/usr/bin/env node
// Fails if a banned package resolves anywhere in the installed dependency tree.
//
// `overrides` in package.json already stops axe-core from being *installed* —
// anything that asks for it gets an empty stub instead. That guarantees the
// policy but fails confusingly: the offending tool breaks at runtime with no
// hint as to why. This check runs first and says plainly which dependency
// dragged the banned package in.
//
// See the "axe-core is banned" section of CLAUDE.md.
import { execFileSync } from 'node:child_process';

/** Packages that must never appear in the tree, with the reason for the ban. */
const BANNED = [
  {
    // Matches `axe-core` and every `@axe-core/*` scoped package.
    pattern: /^(axe-core|@axe-core\/.+)$/,
    label: 'axe-core',
    reason: 'banned by project policy — use @afixt/a11y-assert instead',
  },
];

/**
 * Read the installed tree. `npm ls --all --json` exits non-zero for unrelated
 * reasons (peer-dep warnings, extraneous packages), so the output is parsed
 * regardless of exit status.
 * @returns {object} the parsed dependency tree, or an empty tree on failure.
 */
function readTree() {
  let stdout;
  try {
    stdout = execFileSync('npm', ['ls', '--all', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    stdout = error.stdout;
  }

  try {
    return JSON.parse(stdout || '{}');
  } catch {
    console.error('check-banned-deps: could not parse `npm ls --all --json` output.');
    process.exit(1);
  }
}

/**
 * Walk the tree, collecting every path that reaches a banned package.
 * @param {object} node a node of the `npm ls` tree.
 * @param {string[]} trail the dependency names leading to this node.
 * @param {Set<string>} seen resolved paths already visited (cycle guard).
 * @returns {string[]} human-readable dependency chains, one per hit.
 */
function findBanned(node, trail = [], seen = new Set()) {
  const hits = [];

  for (const [name, child] of Object.entries(node.dependencies || {})) {
    const chain = [...trail, name];
    const banned = BANNED.find((entry) => entry.pattern.test(name));

    if (banned) {
      hits.push(`${chain.join(' > ')}  (${banned.label}: ${banned.reason})`);
      // Don't descend into a banned package — one report per path is enough.
      continue;
    }

    // `resolved` is absent for the root and for workspace links; fall back to
    // the chain so those still get a cycle guard.
    const key = child.resolved || chain.join('>');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    hits.push(...findBanned(child, chain, seen));
  }

  return hits;
}

const hits = findBanned(readTree());

if (hits.length > 0) {
  console.error('Banned dependencies found in the installed tree:\n');
  for (const hit of hits) {
    console.error(`  ${hit}`);
  }
  console.error(
    '\nRemove the dependency that pulls it in, or replace it with a tool that ' +
      'does not.\nSee the "axe-core is banned" section of CLAUDE.md.',
  );
  process.exit(1);
}

console.log('check-banned-deps: no banned dependencies in the tree.');
