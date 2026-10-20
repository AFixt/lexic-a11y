// Smoke tests for the PUBLISHED bundles in `dist/`.
//
// Everything else in the suite imports from `src/`, so a bug introduced by the
// build itself is invisible to it. That is exactly how #80 shipped: the Rollup
// Babel options re-declared `@babel/preset-react` without `runtime:
// 'automatic'`, so the bundles compiled to a bare `React.createElement` that
// nothing bound in module scope, and `<Editor>` threw "React is not defined"
// the moment a consumer mounted it — while `npm test` stayed green.
//
// These tests run against real artifacts, so they need `npm run build` first;
// `npm run test:dist` (wired into `check:all` after the build) does that.
import fs from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';

const DIST = path.join(__dirname, '..', 'dist');

const BUNDLES = [
  { name: 'ESM', file: 'index.esm.js' },
  { name: 'CJS', file: 'index.js' },
];

beforeAll(() => {
  if (!fs.existsSync(path.join(DIST, 'index.esm.js'))) {
    throw new Error(
      'dist/ is missing or incomplete — run `npm run build` before `npm run test:dist`.',
    );
  }
});

describe.each(BUNDLES)('$name bundle ($file)', ({ file }) => {
  const bundlePath = path.join(DIST, file);

  it('references no unbound global `React`', () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is built from __dirname, not input
    const code = fs.readFileSync(bundlePath, 'utf8');

    // With the automatic JSX runtime, JSX compiles to `react/jsx-runtime`
    // imports and no module names `React` at all. Any surviving `React` token
    // is therefore either the classic-runtime regression this guards against
    // or a deliberate `import React from 'react'` — and the latter is not a
    // pattern this package uses (see rollup.config.js). Fail on both so the
    // build convention stays enforced rather than assumed.
    expect(code).not.toMatch(/\bReact\b/);
  });

  it('mounts <Editor> without throwing', () => {
    // `require` rather than a static import: the path is computed per bundle,
    // and each bundle carries its own copy of Lexical and i18next, so they
    // must not share module state.
    const bundle = require(bundlePath);
    const Editor = bundle.default;

    expect(typeof Editor).toBe('function');

    render(<Editor onContentChange={() => {}} />);

    // The Lexical content surface is what a consumer actually types into —
    // reaching it proves the component tree rendered, not just that the
    // module imported.
    expect(screen.getByRole('textbox', { name: 'Editor content' })).toBeInTheDocument();
  });

  it('exposes the documented named exports', () => {
    const bundle = require(bundlePath);

    expect(typeof bundle.ToolbarPlugin).toBe('function');
    expect(typeof bundle.i18n.t).toBe('function');
  });
});

// The editor is unusable without its stylesheet, and the failure is silent:
// every class still lands on the markup, so nothing throws and nothing logs —
// `.editor-toolbar` just falls back to `display: block`, stacking each toolbar
// group on its own line, and `.editor-content-area` loses the border and
// min-height that make the editing box visible. `src/lib.js` imports the CSS,
// but postcss extracts it to `dist/styles.css` and drops the import, so for two
// major versions the published JS carried no styles and no consumer loaded them
// unless it had read the README (meetabl MTBL-202).
describe('stylesheet delivery', () => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is built from __dirname, not input
  const read = (file) => fs.readFileSync(path.join(DIST, file), 'utf8');

  it('ships the stylesheet', () => {
    expect(fs.existsSync(path.join(DIST, 'styles.css'))).toBe(true);
  });

  it('ships the rules whose absence is the reported breakage', () => {
    const css = read('styles.css');

    expect(css).toMatch(/\.editor-toolbar\s*\{[^}]*display\s*:\s*flex/);
    expect(css).toMatch(/\.editor-content-area\s*\{[^}]*border\s*:/);
  });

  it('makes the ESM bundle import it, so a bundler loads it unprompted', () => {
    // This is what a consumer's bundler reads. Without the import the
    // stylesheet is just a file in the package that nothing references.
    expect(read('index.esm.js')).toMatch(/^import\s*["']\.\/styles\.css["']/);
  });

  it('leaves the CJS bundle alone, because Node cannot require CSS', () => {
    // `require('./styles.css')` throws outside a bundler, so the CJS artifact
    // keeps the manual-import contract the README documents.
    expect(read('index.js')).not.toMatch(/styles\.css/);
  });

  it('does not inline the CSS into the JS', () => {
    // Inlining would inject a <style> element at import time, which a
    // `style-src` CSP without 'unsafe-inline' blocks — the same silent
    // breakage again, for anyone with a strict policy.
    expect(read('index.esm.js')).not.toMatch(/--primary-color\s*:/);
  });
});

// The server-side afixt-engine adapter is its own entry (issue #155): Node
// hosts load it without the editor, so it must not drag React, Lexical or the
// engine itself in with it.
describe.each([
  { name: 'CJS', file: 'afixt-engine.js' },
  { name: 'ESM', file: 'afixt-engine.esm.js' },
])('afixt-engine adapter, $name ($file)', ({ file }) => {
  it('imports nothing', () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is built from __dirname, not input
    const code = fs
      .readFileSync(path.join(DIST, file), 'utf8')
      // The header comment shows host wiring with require(); that is prose.
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/\brequire\(|^\s*import\s/m);
  });
});

describe('afixt-engine adapter (CJS)', () => {
  it('turns an engine result into editor issues through an injected engine', async () => {
    const { createAfixtEngineChecker, toAccessibilityIssues } = require(
      path.join(DIST, 'afixt-engine.js'),
    );
    const result = {
      tests: [
        {
          id: 'RULE-1',
          status: 'fail',
          type: 'automatic',
          checkTitle: 'A check',
          issues: [{ issueId: 'one', location: { xpath: '/html[1]/body[1]/main[1]/p[1]' } }],
        },
      ],
    };

    expect(toAccessibilityIssues(result)).toHaveLength(1);
    const check = createAfixtEngineChecker({ test: async () => result });
    await expect(check({ html: '<p>x</p>' })).resolves.toEqual([
      expect.objectContaining({ id: 'one', ruleId: 'RULE-1', title: 'A check' }),
    ]);
  });

  it('ships its type declarations beside it', () => {
    expect(fs.existsSync(path.join(DIST, 'afixt-engine.d.ts'))).toBe(true);
  });
});
