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
