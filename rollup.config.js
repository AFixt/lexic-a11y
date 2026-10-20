import fs from 'fs';
import path from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';
import { terser } from 'rollup-plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

const packageJson = require('./package.json');
const shouldVisualize = process.env.ANALYZE === 'true';

// The source is JavaScript, so there is no `tsc` step to emit declarations.
// `src/index.d.ts` is hand-maintained; copy it to the path `package.json`
// advertises as `types` so TypeScript consumers resolve real types instead of
// silently falling back to `any`.
function copyTypeDeclarations(source, destination) {
  return {
    name: 'copy-type-declarations',
    // `writeBundle` runs after the bundle is on disk, so the output directory
    // already exists — no mkdir needed.
    writeBundle() {
      fs.copyFileSync(path.resolve(source), path.resolve(destination));
    },
  };
}

const editorBundle = {
  // Side-effect-free library entry. `src/index.js` is the Vite demo bootstrap
  // (it renders into `#root`) and must NOT be the published entry, or importing
  // the package would try to mount the demo app in the host page.
  input: 'src/lib.js',
  output: [
    {
      file: packageJson.main,
      format: 'cjs',
      sourcemap: true,
      // The entry intentionally has a default export (Editor) plus named
      // exports (i18n, ToolbarPlugin); 'named' keeps default at `.default`.
      exports: 'named',
    },
    {
      file: packageJson.module,
      format: 'esm',
      sourcemap: true,
      exports: 'named',
      // `src/lib.js` imports `./styles/Editor.css`, but the postcss plugin
      // below extracts it to `dist/styles.css` and drops the import, so the
      // published JS carried no styles and nothing loaded them. Consumers got
      // unstyled markup — `.editor-toolbar` fell back to `display: block`, so
      // every toolbar group stacked on its own line, and `.editor-content-area`
      // lost its border and min-height, so the editing box disappeared. The
      // README listed the import as a setup step, which made this a silent
      // footgun rather than an error anyone could see (meetabl MTBL-202).
      //
      // Re-stating the import here puts it back in the artifact a bundler
      // actually reads, so Vite/webpack pull `dist/styles.css` in on their own.
      // It is a banner, not a source import, because it must appear in this
      // output only: the CJS bundle is what Node loads, and `require()` of a
      // .css file throws there. CJS consumers keep importing the stylesheet
      // themselves, as the README says.
      //
      // Emitting the file rather than inlining the CSS keeps this working
      // under a `style-src` CSP with no 'unsafe-inline', and keeps
      // `dist/styles.css` on disk for anyone already importing that path.
      banner: "import './styles.css';",
    },
  ],
  plugins: [
    peerDepsExternal(),
    resolve({
      extensions: ['.js', '.jsx'],
    }),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      // Presets deliberately live ONLY in `babel.config.js`. Repeating
      // `@babel/preset-react` here overrode that file's `runtime: 'automatic'`
      // with the classic runtime (Babel merges same-named presets, and the
      // programmatic options win), so every component compiled to a bare
      // `React.createElement` that nothing bound in module scope — the
      // published bundles threw "React is not defined" on mount (#80).
      // One source of truth keeps the built output and the test/dev transform
      // from drifting apart again.
    }),
    commonjs(),
    postcss({
      extensions: ['.css'],
      extract: path.resolve('dist/styles.css'),
      minimize: true,
    }),
    terser(),
    copyTypeDeclarations('src/index.d.ts', packageJson.types),
    shouldVisualize &&
      visualizer({
        filename: 'reports/bundle-stats.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }),
  ].filter(Boolean),
  external: Object.keys(packageJson.peerDependencies || {}),
};

// The server-side @afixt/afixt-engine adapter (issue #155), a separate entry so
// Node hosts can load it without the editor, React or Lexical. It imports
// nothing — the host passes its own engine in — so there is nothing to
// resolve, transpile for browsers, or mark external.
const afixtEngineAdapter = {
  input: 'src/afixt-engine.js',
  output: [
    { file: 'dist/afixt-engine.js', format: 'cjs', sourcemap: true, exports: 'named' },
    { file: 'dist/afixt-engine.esm.js', format: 'esm', sourcemap: true },
  ],
  plugins: [copyTypeDeclarations('src/afixt-engine.d.ts', 'dist/afixt-engine.d.ts')],
};

export default [editorBundle, afixtEngineAdapter];
