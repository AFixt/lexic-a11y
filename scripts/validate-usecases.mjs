#!/usr/bin/env node
// Validate every use-case YAML in usecases/ against @afixt/usecase-runner.
//
// Why a script rather than `usecase-runner validate usecases/`: in directory
// mode the runner prints the first "Validation error" and then exits 0, so a
// broken use case would pass CI silently — a gate that cannot fail is no gate
// (#107). Single-file mode exits non-zero correctly, so we validate each file
// individually and aggregate, and additionally treat any "error" in the output
// as a failure as a belt-and-suspenders backstop.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Resolve the CLI from the installed package so this works whether or not
// node_modules/.bin is on PATH.
const bin = path.join(root, 'node_modules', '@afixt', 'usecase-runner', 'bin', 'usecase-runner.js');

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
    ok = false;
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  if (/\berror\b/i.test(output)) ok = false;
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
