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
function copyTypeDeclarations() {
  return {
    name: 'copy-type-declarations',
    // `writeBundle` runs after the bundle is on disk, so the output directory
    // already exists — no mkdir needed.
    writeBundle() {
      fs.copyFileSync(path.resolve('src/index.d.ts'), path.resolve(packageJson.types));
    },
  };
}

export default {
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
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }),
    commonjs(),
    postcss({
      extensions: ['.css'],
      extract: path.resolve('dist/styles.css'),
      minimize: true,
    }),
    terser(),
    copyTypeDeclarations(),
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
