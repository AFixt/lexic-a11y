// Guards the published type declarations against drifting from the real
// exports.
//
// `src/index.d.ts` is hand-maintained (the source is JavaScript — see
// docs/adr/0002-remain-on-javascript.md), so nothing stops someone adding,
// renaming, or removing an export in `src/lib.js` without touching the
// declarations. `npm run types:check` only proves the .d.ts compiles; this test
// proves it describes the module Rollup actually builds.
import fs from 'fs';
import path from 'path';

import * as lib from '../lib';

const declarations = fs.readFileSync(path.join(__dirname, '..', 'index.d.ts'), 'utf8');

/** Names declared as value exports (not `export type`/`export interface`). */
function declaredValueExports(source) {
  const names = new Set();
  // `export declare function Foo(` / `export declare const Foo:`
  for (const match of source.matchAll(/export declare (?:function|const)\s+(\w+)/g)) {
    names.add(match[1]);
  }
  // `export default Editor;` — the default export's binding name is irrelevant
  // to consumers, so record it under the key Node/Rollup expose it as.
  if (/^export default \w+;/m.test(source)) {
    names.add('default');
  }
  return names;
}

describe('published type declarations', () => {
  it('declares exactly the value exports of the library entry', () => {
    const runtime = new Set(Object.keys(lib));
    expect(declaredValueExports(declarations)).toEqual(runtime);
  });

  it('exports the editor as the default export', () => {
    expect(typeof lib.default).toBe('function');
  });

  it('exports the toolbar plugin and the configured i18n instance', () => {
    expect(typeof lib.ToolbarPlugin).toBe('function');
    expect(typeof lib.i18n.t).toBe('function');
    expect(lib.i18n.language).toBe('en');
  });
});
