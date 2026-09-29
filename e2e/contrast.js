// contrast.js — shared WCAG contrast measurement for the Playwright suites.
//
// Contrast can only be judged from computed CSS, and jsdom loads no
// stylesheets, so these helpers run against a real browser page. They were
// extracted from editor.spec.js so the theme suite (theme-contrast.spec.js,
// issue #154) measures exactly the same way.
import { expect } from '@playwright/test';

/** Parse a computed `rgb()`/`rgba()` string into channels plus alpha. */
export const parseColor = (value) => {
  const match = /rgba?\(([^)]+)\)/.exec(value ?? '');
  if (!match) return null;
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  const [r, g, b, a = 1] = parts;
  return { r, g, b, a };
};

/** Flatten a translucent color onto an opaque backdrop. */
export const flatten = (fg, bg) => ({
  r: fg.a * fg.r + (1 - fg.a) * bg.r,
  g: fg.a * fg.g + (1 - fg.a) * bg.g,
  b: fg.a * fg.b + (1 - fg.a) * bg.b,
  a: 1,
});

/** WCAG relative luminance. */
const luminance = ({ r, g, b }) => {
  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio between two opaque colors. */
export const contrastRatio = (one, two) => {
  const [lighter, darker] = [luminance(one), luminance(two)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * For each element matching `selector`, read one computed paint (`property`,
 * a kebab-case CSS property), its font metrics, and the stack of backgrounds
 * painted behind it — walking from the element itself (`behind: 'self'`) or
 * its parent (`behind: 'parent'`, for a border or ring drawn at the edge) up
 * through the ancestors until the first fully opaque layer — plus a label for
 * error messages.
 */
const readPaints = (page, selector, { property = 'color', behind = 'self' } = {}) =>
  page.evaluate(
    ({ sel, prop, from }) =>
      [...document.querySelectorAll(sel)].map((element) => {
        const styles = getComputedStyle(element);

        // Every painted layer matters: a translucent background is not the
        // backdrop itself, it is composited over whatever is beneath it.
        const backgrounds = [];
        const start = from === 'parent' ? element.parentElement : element;
        for (let node = start; node; node = node.parentElement) {
          const background = getComputedStyle(node).backgroundColor;
          const match = /rgba?\(([^)]+)\)/.exec(background);
          const alpha = match ? Number.parseFloat(match[1].split(',')[3] ?? '1') : 0;
          if (alpha > 0) {
            backgrounds.push(background);
            if (alpha === 1) break;
          }
        }

        const owner = element.closest('button') || element;
        return {
          label:
            owner.getAttribute('aria-label') ||
            `${owner.tagName.toLowerCase()} "${(owner.textContent || '').trim().slice(0, 30)}"`,
          paint: styles.getPropertyValue(prop),
          fontSize: Number.parseFloat(styles.fontSize),
          fontWeight: Number.parseFloat(styles.fontWeight),
          backgrounds,
        };
      }),
    { sel: selector, prop: property, from: behind },
  );

/**
 * Composite a background stack bottom-up (over white, the page default) so
 * translucent layers are seen as rendered, not at their nominal colour.
 */
const compositeBackdrop = (backgrounds) =>
  [...backgrounds]
    .reverse()
    .reduce((below, layer) => flatten(parseColor(layer), below), { r: 255, g: 255, b: 255, a: 1 });

/**
 * Measure every match and assert each clears its threshold. A translucent
 * paint is seen as its composite over the backdrop, so that is what is judged.
 */
const expectPaints = async (page, selector, options, thresholdFor) => {
  const entries = await readPaints(page, selector, options);
  expect(entries.length, `${selector} matched nothing`).toBeGreaterThan(0);

  for (const entry of entries) {
    const backdrop = compositeBackdrop(entry.backgrounds);
    const paint = parseColor(entry.paint);
    expect(paint, `${entry.label}: ${entry.paint} is not a colour`).not.toBeNull();
    const ratio = contrastRatio(flatten(paint, backdrop), backdrop);
    const backdropLabel = `rgb(${Math.round(backdrop.r)}, ${Math.round(backdrop.g)}, ${Math.round(backdrop.b)})`;

    expect(
      ratio,
      `${entry.label}: ${entry.paint} on ${backdropLabel} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(thresholdFor(entry));
  }
};

/**
 * SC 1.4.3 threshold: large-scale text (24px+, or bold 18.66px+) needs 3:1,
 * everything else 4.5:1.
 */
const requiredRatio = ({ fontSize, fontWeight }) =>
  fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;

/** Assert every element matching `selector` meets its SC 1.4.3 threshold. */
export const expectReadableText = (page, selector) =>
  expectPaints(page, selector, { property: 'color' }, requiredRatio);

/**
 * Assert a non-text paint — an icon's `color`, a `border-top-color`, a
 * `box-shadow` ring — clears `min` (SC 1.4.11: 3:1) against what is painted
 * behind it. `behind: 'self'` measures against the element's own background
 * stack (an icon drawn inside its button); `behind: 'parent'` against the stack
 * outside the element (a border or ring, seen against its surroundings).
 */
export const expectPaintContrast = (
  page,
  selector,
  { property = 'color', behind = 'self', min = 3 } = {},
) => expectPaints(page, selector, { property, behind }, () => min);
