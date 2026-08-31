/**
 * Guards the very-small-text floor across the stylesheets this package ships.
 *
 * The AFixt rule engine's LANG-29 ("Very small text found") fires on any
 * computed font-size below 12px. The heading-preview toolbar buttons used to
 * step down decoratively to 11px on H6 (issue #133), which is real button label
 * text rendered below that minimum. These tests read the stylesheets as text so
 * a future decorative tweak can't reintroduce the problem unnoticed.
 *
 * Only absolute px lengths are judged. em/rem/%/vw values depend on an
 * inherited or viewport size the stylesheet doesn't own, so this file can't
 * decide whether they're readable.
 */
import fs from 'node:fs';
import path from 'node:path';

const STYLES_DIR = path.join(__dirname, '..');
const MIN_READABLE_PX = 12;

const DECLARATION = /(font-size|font)\s*:\s*([^;}]*)/gi;
const IMPORTANT = /!\s*important\s*$/i;
const PX_LENGTH = /(?:^|[\s/(,])([0-9.]+)px/gi;

/**
 * Lists every absolute px length in a declaration value.
 *
 * @param {string} value Declaration value, e.g. `12px !important`.
 * @returns {number[]} The px lengths, in source order.
 */
function pxLengths(value) {
  return [...value.matchAll(PX_LENGTH)].map((match) => Number.parseFloat(match[1]));
}

/**
 * Collects the effective font size of every `font-size` and `font` declaration
 * that resolves to an absolute px length.
 *
 * `font-size` takes the smallest px length in its value, so a `clamp()` or a
 * `var()` fallback is judged by its floor rather than its happy path. The `font`
 * shorthand takes the first, which is the size component -- any px after the
 * slash is the line-height, not the text size.
 *
 * @param {string} css Stylesheet source.
 * @param {string} label Name used in failure output.
 * @returns {Array<{location: string, value: number, text: string}>} One entry
 *   per px-valued declaration.
 */
function parsePxFontSizes(css, label = 'stylesheet') {
  const found = [];

  css.split('\n').forEach((line, index) => {
    for (const [, property, rawValue] of line.matchAll(DECLARATION)) {
      const lengths = pxLengths(rawValue.replace(IMPORTANT, '').trim());
      if (lengths.length === 0) continue;

      // The shorthand's first px is the size; anything later is line-height.
      // A `font-size` is judged by its floor, so clamp()/var() fallbacks count.
      const value = property.toLowerCase() === 'font' ? lengths[0] : Math.min(...lengths);

      found.push({ location: `${label}:${index + 1}`, value, text: line.trim() });
    }
  });

  return found;
}

/**
 * Every stylesheet under src/, relative path first.
 *
 * @returns {Array<{name: string, css: string}>} Stylesheet sources.
 */
function readStylesheets() {
  return fs
    .readdirSync(STYLES_DIR, { recursive: true })
    .filter((entry) => typeof entry === 'string' && entry.endsWith('.css'))
    .map((entry) => ({
      name: entry.split(path.sep).join('/'),
      // Path comes from readdirSync over a fixed in-repo directory, not input.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      css: fs.readFileSync(path.join(STYLES_DIR, entry), 'utf8'),
    }));
}

/**
 * Every px-valued declaration across the given stylesheets.
 *
 * @param {Array<{name: string, css: string}>} stylesheets Stylesheet sources.
 * @returns {Array<{location: string, value: number, text: string}>} Declarations.
 */
function parseAll(stylesheets) {
  return stylesheets.flatMap((sheet) => parsePxFontSizes(sheet.css, sheet.name));
}

describe('parsePxFontSizes', () => {
  it('reads a plain px declaration', () => {
    expect(parsePxFontSizes('a { font-size: 11px; }')[0].value).toBe(11);
  });

  it('reads a px declaration marked !important', () => {
    expect(parsePxFontSizes('a { font-size: 8px !important; }')[0].value).toBe(8);
  });

  it('reads the size out of the font shorthand', () => {
    expect(parsePxFontSizes('a { font: bold 8px/1.2 sans-serif; }')[0].value).toBe(8);
  });

  it('judges the shorthand by its size, not its line-height', () => {
    expect(parsePxFontSizes('a { font: bold 16px/8px sans-serif; }')[0].value).toBe(16);
  });

  it('judges font-size by the smallest length it could resolve to', () => {
    expect(parsePxFontSizes('a { font-size: clamp(8px, 2vw, 16px); }')[0].value).toBe(8);
    expect(parsePxFontSizes('a { font-size: var(--x, 9px); }')[0].value).toBe(9);
  });

  it('is case-insensitive and tolerates loose spacing', () => {
    expect(parsePxFontSizes('a { FONT-SIZE:11PX; }')[0].value).toBe(11);
  });

  it('finds several declarations on one line', () => {
    const found = parsePxFontSizes('a { font-size: 10px; } b { font-size: 11px; }');

    expect(found.map((decl) => decl.value)).toEqual([10, 11]);
  });

  it('ignores relative and keyword values it cannot judge', () => {
    expect(parsePxFontSizes('a { font-size: 1rem; }')).toEqual([]);
    expect(parsePxFontSizes('a { font-size: 0.85em; }')).toEqual([]);
    expect(parsePxFontSizes('a { font-size: inherit; }')).toEqual([]);
    expect(parsePxFontSizes('a { font: menu; }')).toEqual([]);
  });

  it('does not mistake other font-* properties for a size', () => {
    expect(parsePxFontSizes('a { font-weight: 600; font-family: Arial; }')).toEqual([]);
  });

  it('reports a 1-indexed location', () => {
    expect(parsePxFontSizes('a {\n  font-size: 11px;\n}', 'x.css')[0].location).toBe('x.css:2');
  });
});

describe('shipped stylesheet font sizes', () => {
  const stylesheets = readStylesheets();

  it('finds the stylesheets to check', () => {
    expect(stylesheets.map((sheet) => sheet.name)).toContain('styles/Editor.css');
  });

  it('declares no px font-size below the very-small-text minimum', () => {
    const tooSmall = parseAll(stylesheets).filter((decl) => decl.value < MIN_READABLE_PX);

    expect(tooSmall.map((decl) => `${decl.location} ${decl.text}`)).toEqual([]);
  });

  it('finds px font-size declarations to check (the parser still matches)', () => {
    expect(parseAll(stylesheets).length).toBeGreaterThan(0);
  });

  it('floors the heading-button scale so H5 and H6 sit on the minimum', () => {
    // The H6 button is what issue #133 reported; H5 shares the floor with it.
    const editor = stylesheets.find((sheet) => sheet.name === 'styles/Editor.css').css;

    expect(editor).toContain(
      `.heading-button:nth-child(5) {\n  font-size: ${MIN_READABLE_PX}px;\n}`,
    );
    expect(editor).toContain(
      `.heading-button:nth-child(6) {\n  font-size: ${MIN_READABLE_PX}px;\n}`,
    );
  });
});
