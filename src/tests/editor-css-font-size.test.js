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
 *
 * That exemption is exactly how issue #135 got through: the active
 * heading-preview buttons declared `font-size: inherit`, which is not a px
 * length, so the scan below skipped it while it silently replaced the stepped
 * size with the host's ambient one. The floor is only a floor if nothing on
 * those elements can route around it, so the heading buttons additionally get
 * a stricter rule-level check further down: on them, a font-size must be an
 * absolute px at or above the minimum, and a relative or keyword value fails.
 */
import fs from 'node:fs';
import path from 'node:path';

const STYLES_DIR = path.join(__dirname, '..');
const MIN_READABLE_PX = 12;

const DECLARATION = /(font-size|font)\s*:\s*([^;}]*)/gi;
const IMPORTANT = /!\s*important\s*$/i;
const PX_LENGTH = /(?:^|[\s/(,])([0-9.]+)px/gi;
const RULE = /([^{}]*)\{([^{}]*)\}/g;
const COMMENT = /\/\*[\s\S]*?\*\//g;
const COLLAPSE_SPACE = /\s+/g;

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

  // Scanned over the whole source rather than line by line: prettier wraps a
  // long value onto continuation lines (see the font-family stacks in
  // Editor.css), and a wrapped `font` shorthand would slip past a line-based
  // parser entirely.
  for (const match of css.matchAll(DECLARATION)) {
    const [text, property, rawValue] = match;
    const lengths = pxLengths(rawValue.replace(IMPORTANT, '').trim());
    if (lengths.length === 0) continue;

    // The shorthand's first px is the size; anything later is line-height.
    // A `font-size` is judged by its floor, so clamp()/var() fallbacks count.
    const value = property.toLowerCase() === 'font' ? lengths[0] : Math.min(...lengths);
    const line = css.slice(0, match.index).split('\n').length;

    found.push({
      location: `${label}:${line}`,
      value,
      text: text.trim().replace(COLLAPSE_SPACE, ' '),
    });
  }

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

/**
 * Splits a stylesheet into its rules. At-rule preludes are not selectors, so a
 * rule nested in a media query is found by its own inner selector list; that
 * is what keeps a heading-button rule from hiding inside `@media`.
 *
 * @param {string} css Stylesheet source.
 * @returns {Array<{selector: string, body: string, index: number}>} Each rule.
 */
function parseRules(css) {
  // Comments are blanked, not deleted, so byte offsets still map to the right
  // source line. Leaving them in would glue a comment onto the selector of the
  // rule that follows it -- and this stylesheet has a comment about the
  // heading buttons sitting directly above an unrelated rule, which would then
  // be checked as though it targeted one.
  const stripped = css.replace(COMMENT, (comment) => comment.replace(/[^\n]/g, ' '));

  return [...stripped.matchAll(RULE)].map((match) => ({
    selector: match[1].trim().replace(COLLAPSE_SPACE, ' '),
    body: match[2],
    // Where the selector text starts, not where the match does. The match
    // begins at the first character after the previous rule -- blank lines and
    // blanked-out comments included -- so using it would report a location
    // several lines above the rule a developer needs to open.
    index: match.index + (match[1].length - match[1].trimStart().length),
  }));
}

/**
 * Every font-size declared on a heading-preview button, with the absolute px
 * length it resolves to -- or `undefined` when it is relative or a keyword,
 * which means the host's ambient size decides and the floor does not apply.
 *
 * @param {Array<{name: string, css: string}>} stylesheets Stylesheet sources.
 * @returns {Array<{location: string, selector: string, text: string, px: number | undefined}>} Declarations.
 */
function headingButtonFontSizes(stylesheets) {
  return stylesheets.flatMap(({ name, css }) =>
    parseRules(css)
      .filter((rule) => rule.selector.includes('.heading-button'))
      .flatMap((rule) =>
        [...rule.body.matchAll(DECLARATION)].map((match) => {
          const [text, property, rawValue] = match;
          const lengths = pxLengths(rawValue.replace(IMPORTANT, '').trim());
          const isShorthand = property.toLowerCase() === 'font';

          return {
            location: `${name}:${css.slice(0, rule.index).split('\n').length}`,
            selector: rule.selector,
            text: text.trim().replace(COLLAPSE_SPACE, ' '),
            px: lengths.length === 0 ? undefined : isShorthand ? lengths[0] : Math.min(...lengths),
          };
        }),
      ),
  );
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

  it('reads a value wrapped across continuation lines', () => {
    const css = 'a {\n  font: bold 8px/1.4\n    -apple-system,\n    sans-serif;\n}';

    expect(parsePxFontSizes(css)[0].value).toBe(8);
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

describe('heading-button font sizes are absolute (#135)', () => {
  const stylesheets = readStylesheets();

  it('finds the heading-button rules to check', () => {
    expect(headingButtonFontSizes(stylesheets).length).toBeGreaterThan(0);
  });

  it('declares no relative or keyword font-size on a heading button', () => {
    // `inherit` takes the parent's computed size, so it replaces the stepped
    // size rather than preserving it and the 12px floor stops applying. Any
    // relative unit has the same effect: the host's ambient size decides.
    const escaping = headingButtonFontSizes(stylesheets).filter((decl) => decl.px === undefined);

    expect(escaping.map((decl) => `${decl.location} {${decl.selector}} ${decl.text}`)).toEqual([]);
  });

  it('declares no heading-button font-size below the very-small-text minimum', () => {
    const tooSmall = headingButtonFontSizes(stylesheets).filter(
      (decl) => decl.px !== undefined && decl.px < MIN_READABLE_PX,
    );

    expect(tooSmall.map((decl) => `${decl.location} {${decl.selector}} ${decl.text}`)).toEqual([]);
  });
});

describe('headingButtonFontSizes', () => {
  const sheet = (css) => [{ name: 'x.css', css }];

  it('accepts an absolute px at the floor', () => {
    expect(headingButtonFontSizes(sheet('.heading-button { font-size: 12px; }'))[0].px).toBe(12);
  });

  it('reports a keyword value as having no px equivalent', () => {
    const [decl] = headingButtonFontSizes(sheet('.heading-button.active { font-size: inherit; }'));

    expect(decl.px).toBeUndefined();
    expect(decl.selector).toContain('.heading-button');
  });

  it('reports a relative value as having no px equivalent', () => {
    expect(headingButtonFontSizes(sheet('.heading-button { font-size: 0.9em; }'))[0].px).toBe(
      undefined,
    );
  });

  it('reads the size out of the font shorthand too', () => {
    expect(
      headingButtonFontSizes(sheet('.heading-button { font: 600 11px/1.2 sans; }'))[0].px,
    ).toBe(11);
  });

  it('finds a heading-button rule nested inside a media query', () => {
    const css =
      '@media (forced-colors: active) {\n  .heading-button.active {\n    font-size: inherit;\n  }\n}';

    expect(headingButtonFontSizes(sheet(css))).toHaveLength(1);
  });

  it('picks the heading-button selector out of a multi-selector rule', () => {
    const css = ".quote-button,\n.heading-button[aria-pressed='true'] {\n  font-size: inherit;\n}";

    expect(headingButtonFontSizes(sheet(css))).toHaveLength(1);
  });

  it('ignores rules that do not target a heading button', () => {
    expect(headingButtonFontSizes(sheet('.quote-button { font-size: inherit; }'))).toEqual([]);
  });

  it('does not treat a comment mentioning a heading button as a selector', () => {
    // Measured before comments were stripped: the comment glued itself onto
    // the following selector, so this unrelated rule was checked and failed.
    const css = '/* see .heading-button above */\n.quote-button {\n  font-size: inherit;\n}';

    expect(headingButtonFontSizes(sheet(css))).toEqual([]);
  });

  it('still reports the right source line after a multi-line comment', () => {
    const css = '/* one\n   two\n   three */\n.heading-button {\n  font-size: 11px;\n}';

    expect(headingButtonFontSizes(sheet(css))[0].location).toBe('x.css:4');
  });

  it('ignores non-size font properties on a heading button', () => {
    expect(
      headingButtonFontSizes(sheet('.heading-button { font-weight: 600; font-family: Arial; }')),
    ).toEqual([]);
  });
});
