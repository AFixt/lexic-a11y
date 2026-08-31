/**
 * Guards the very-small-text floor in src/styles/Editor.css.
 *
 * The AFixt rule engine's LANG-29 ("Very small text found") fires on any
 * computed font-size below 12px. The heading-preview toolbar buttons used to
 * step down decoratively to 11px on H6 (issue #133), which is real button label
 * text rendered below that minimum. This test reads the stylesheet as text so a
 * future decorative tweak can't reintroduce the problem unnoticed.
 *
 * Only absolute px declarations are checked — em/rem values depend on an
 * inherited size the stylesheet doesn't own, so they can't be judged here.
 */
import fs from 'node:fs';
import path from 'node:path';

const CSS_PATH = path.join(__dirname, '..', 'styles', 'Editor.css');
const MIN_READABLE_PX = 12;

const FONT_SIZE_VALUE = /font-size:\s*([^;]+)/i;
const ABSOLUTE_PX = /^([0-9.]+)px$/;

/**
 * Collects every `font-size` declared in absolute px units.
 *
 * @param {string} css Stylesheet source.
 * @returns {Array<{line: number, value: number, text: string}>} One entry per
 *   px declaration, with its 1-indexed line number.
 */
function parsePxFontSizes(css) {
  const found = [];

  css.split('\n').forEach((text, index) => {
    const declaration = FONT_SIZE_VALUE.exec(text);
    if (!declaration) return;

    const px = ABSOLUTE_PX.exec(declaration[1].trim());
    if (!px) return;

    found.push({ line: index + 1, value: Number.parseFloat(px[1]), text: text.trim() });
  });

  return found;
}

describe('Editor.css font sizes', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  it('declares no px font-size below the very-small-text minimum', () => {
    const tooSmall = parsePxFontSizes(css).filter((decl) => decl.value < MIN_READABLE_PX);

    expect(tooSmall.map((decl) => `Editor.css:${decl.line} ${decl.text}`)).toEqual([]);
  });

  it('finds px font-size declarations to check (the parser still matches)', () => {
    expect(parsePxFontSizes(css).length).toBeGreaterThan(0);
  });

  it('floors the heading-button scale so H5 and H6 sit on the minimum', () => {
    // The H6 button is what issue #133 reported; H5 shares the floor with it.
    expect(css).toContain(`.heading-button:nth-child(5) {\n  font-size: ${MIN_READABLE_PX}px;\n}`);
    expect(css).toContain(`.heading-button:nth-child(6) {\n  font-size: ${MIN_READABLE_PX}px;\n}`);
  });
});
