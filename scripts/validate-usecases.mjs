#!/usr/bin/env node
// Validate every use-case YAML in usecases/ against @afixt/usecase-runner.
//
// Why a script rather than one CLI call: `usecase-runner validate` takes a
// single positional <path>. Passing a directory works and exits non-zero on the
// first invalid file, but the form the README once used —
// `usecase-runner validate usecases/*.uc.yaml` — shell-globs to many arguments,
// of which the runner silently accepts only the first and drops the rest. If
// that first (alphabetically-first) file is valid, the command reports success
// and exits 0 while never looking at the other files — a gate that cannot fail
// is no gate (#107). Driving the CLI one file at a time sidesteps that entirely
// and reports every failure rather than stopping at the first.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'usecases');

if (!existsSync(dir)) {
  console.error(`No usecases/ directory at ${dir}`);
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.uc.yaml'))
  .sort();

if (files.length === 0) {
  console.error(`No .uc.yaml files found in ${dir}`);
  process.exit(1);
}

// Resolve the CLI from the installed package's `bin` field rather than assuming
// a fixed node_modules layout, so a hoisting change doesn't break this silently.
const pkgJson = require.resolve('@afixt/usecase-runner/package.json');
const pkg = require('@afixt/usecase-runner/package.json');
const binField = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['usecase-runner'];
const bin = path.resolve(path.dirname(pkgJson), binField);

let failed = 0;
for (const file of files) {
  const rel = path.join('usecases', file);
  let output = '';
  let ok = true;
  try {
    output = execFileSync(process.execPath, [bin, 'validate', path.join(dir, file)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // Non-zero exit is the primary signal (reliable for single-file validate).
    ok = false;
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  // Backstop only against the runner's own error phrasing, so a success message
  // that merely contains the word "error" (e.g. "0 errors") can't flip a pass.
  if (/Validation error|Unknown (step keyword|role token)/i.test(output)) ok = false;
  if (ok) {
    console.log(`ok    ${rel}`);
  } else {
    failed += 1;
    const detail = output.trim().split('\n').join('\n      ');
    console.error(`FAIL  ${rel}\n      ${detail}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} use case(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} use cases are valid.`);
