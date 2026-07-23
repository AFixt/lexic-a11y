// editor.spec.js — E2E smoke tests for the demo app in a real browser
import { expect, test } from '@playwright/test';

const EDITOR = '.editor-input';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(EDITOR)).toBeVisible();
});

test.describe('basic editing', () => {
  test('typing inserts text into the editor', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Hello accessible world');

    await expect(page.locator(EDITOR)).toContainText('Hello accessible world');
  });

  test('bold formatting via the toolbar button', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Make me bold');
    await page.keyboard.press('ControlOrMeta+a');

    await page.getByRole('button', { name: 'Bold' }).click();

    await expect(page.locator(`${EDITOR} strong`)).toHaveText('Make me bold');
  });

  test('italic formatting via keyboard shortcut', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Make me italic');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+i');

    await expect(page.locator(`${EDITOR} em`)).toHaveText('Make me italic');
  });

  test('heading formatting produces a semantic h1', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Document title');

    await page.getByRole('button', { name: 'H1' }).click();

    await expect(page.locator(`${EDITOR} h1`)).toHaveText('Document title');
  });

  test('bullet list via the toolbar produces semantic markup', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('First item');

    await page.getByRole('button', { name: 'Bullet List' }).click();

    await expect(page.locator(`${EDITOR} ul li`)).toHaveText('First item');
  });

  test('undo restores prior content (keyboard-only)', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Keep me');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await expect(page.locator(EDITOR)).not.toContainText('Keep me');

    await page.keyboard.press('ControlOrMeta+z');

    await expect(page.locator(EDITOR)).toContainText('Keep me');
  });
});

test.describe('link dialog', () => {
  test('inserts a link through the accessible dialog', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('lexical');
    await page.keyboard.press('ControlOrMeta+a');

    await page.getByRole('button', { name: 'Link' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus moves into the dialog's URL field
    await expect(dialog.getByLabel(/URL/)).toBeFocused();

    await dialog.getByLabel(/URL/).fill('https://lexical.dev');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(page.locator(`${EDITOR} a[href="https://lexical.dev"]`)).toHaveText('lexical');
  });

  test('Escape closes the dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Link' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Wait for focus to move into the dialog before dismissing it
    await expect(dialog.getByLabel(/URL/)).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(dialog).not.toBeVisible();
  });
});

test.describe('keyboard navigation and ARIA', () => {
  test('a keyboard-only editing journey: type, select, bold, verify state', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Keyboard only');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');

    await expect(page.locator(`${EDITOR} strong`)).toHaveText('Keyboard only');
    // Screen-reader-relevant state: the Bold toggle reports pressed
    await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('formatting controls are reachable with the keyboard', async ({ page }) => {
    const bold = page.getByRole('button', { name: 'Bold' });
    await bold.focus();
    await expect(bold).toBeFocused();

    // Move focus off Bold with the keyboard; it must land on another control
    await page.keyboard.press('Tab');
    const focusedLabel = await page.evaluate(
      () => document.activeElement && document.activeElement.getAttribute('aria-label'),
    );
    expect(focusedLabel).not.toBe('Bold');
    expect(focusedLabel).not.toBeNull();
  });

  test('the toolbar exposes the toolbar role with an accessible name', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'Editor Toolbar' });
    await expect(toolbar).toBeVisible();
  });
});

test.describe('initial content', () => {
  test('seeds the editor from host-provided HTML (initialValue)', async ({ page }) => {
    const seed = '<h2>Seeded heading</h2><p>Seeded <strong>paragraph</strong></p>';
    await page.goto(`/?seed=${encodeURIComponent(seed)}`);
    await expect(page.locator(EDITOR)).toBeVisible();

    // The HTML is parsed into live, semantic nodes (not pasted as plain text).
    await expect(page.locator(`${EDITOR} h2`)).toHaveText('Seeded heading');
    await expect(page.locator(`${EDITOR} p strong`)).toHaveText('paragraph');
  });

  test('seeded content is editable and emits HTML output', async ({ page }) => {
    await page.goto(`/?seed=${encodeURIComponent('<p>Start</p>')}`);
    await expect(page.locator(`${EDITOR} p`)).toHaveText('Start');

    // Place the caret at the end of the seeded text and keep typing.
    await page.locator(`${EDITOR} p`).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' and more');

    await expect(page.locator(`${EDITOR} p`)).toContainText('Start and more');
    await expect(page.locator('pre')).toContainText('Start and more');
  });
});

// --- Focus indicators (WCAG 2.2 SC 1.4.11 Non-text Contrast) ---
//
// These live here rather than in src/tests/accessibility.test.js because a
// focus indicator is judged from computed CSS, and jsdom loads no stylesheets:
// there, every element looks unstyled. A real browser is the only place this
// can be measured, so the jsdom suite excludes KEYBOARD-01 and defers to these.

/** Parse a computed `rgb()`/`rgba()` string into channels plus alpha. */
const parseColor = (value) => {
  const match = /rgba?\(([^)]+)\)/.exec(value ?? '');
  if (!match) return null;
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  const [r, g, b, a = 1] = parts;
  return { r, g, b, a };
};

/** Flatten a translucent color onto an opaque backdrop. */
const flatten = (fg, bg) => ({
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
const contrastRatio = (one, two) => {
  const [lighter, darker] = [luminance(one), luminance(two)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Read every style that could carry a focus indicator, plus the first opaque
 * background painted behind the element (the backdrop the indicator sits on).
 */
const readIndicator = (page, selector) =>
  page.evaluate((sel) => {
    const element = document.querySelector(sel);
    const styles = getComputedStyle(element);

    // Walk ancestors for the first non-transparent background — that is what a
    // ring drawn outside the element's border box is actually seen against.
    let backdrop = 'rgb(255, 255, 255)';
    for (let node = element.parentElement; node; node = node.parentElement) {
      const background = getComputedStyle(node).backgroundColor;
      const alpha = /rgba?\(([^)]+)\)/.exec(background);
      if (alpha && Number.parseFloat(alpha[1].split(',')[3] ?? '1') !== 0) {
        backdrop = background;
        break;
      }
    }

    return {
      outline: `${styles.outlineStyle} ${styles.outlineWidth} ${styles.outlineColor}`,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
      outlineColor: styles.outlineColor,
      boxShadow: styles.boxShadow,
      backdrop,
    };
  }, selector);

/**
 * These controls animate with `transition: all 0.2s`, so reading the computed
 * style the instant focus lands catches the indicator mid-animation — a
 * transparent, zero-spread shadow that looks like "no indicator at all". Poll
 * until two consecutive reads agree, so the assertion sees the settled value.
 */
const settledIndicator = async (page, selector) => {
  let previous = await readIndicator(page, selector);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(50);
    const current = await readIndicator(page, selector);
    if (current.boxShadow === previous.boxShadow && current.outline === previous.outline) {
      return current;
    }
    previous = current;
  }
  return previous;
};

/**
 * The indicator's own color: whichever of outline / box-shadow the component
 * actually uses. Returns null when neither paints anything.
 */
const indicatorColor = (styles) => {
  if (styles.outlineStyle !== 'none' && Number.parseFloat(styles.outlineWidth) > 0) {
    return parseColor(styles.outlineColor);
  }
  if (styles.boxShadow && styles.boxShadow !== 'none') {
    return parseColor(styles.boxShadow);
  }
  return null;
};

// --- Text colour contrast (WCAG 2.2 SC 1.4.3 Contrast (Minimum)) ---
//
// Like the focus-indicator checks above, these need real computed styles and
// therefore a real browser: jsdom loads no stylesheets, so the jsdom rule
// suite cannot measure contrast at all (issue #84). Each check reads the
// rendered text colour and the first opaque background painted behind it.

/**
 * For each element matching `selector`, read the computed colour, font metrics,
 * and the first opaque background painted behind the text (walking from the
 * element itself up through its ancestors), plus a label for error messages.
 */
const readTextStyles = (page, selector) =>
  page.evaluate((sel) => {
    const isOpaque = (background) => {
      const match = /rgba?\(([^)]+)\)/.exec(background);
      return match && Number.parseFloat(match[1].split(',')[3] ?? '1') !== 0;
    };

    return [...document.querySelectorAll(sel)].map((element) => {
      const styles = getComputedStyle(element);

      let backdrop = 'rgb(255, 255, 255)';
      for (let node = element; node; node = node.parentElement) {
        const background = getComputedStyle(node).backgroundColor;
        if (isOpaque(background)) {
          backdrop = background;
          break;
        }
      }

      return {
        label:
          element.getAttribute('aria-label') ||
          `${element.tagName.toLowerCase()} "${(element.textContent || '').trim().slice(0, 30)}"`,
        color: styles.color,
        fontSize: Number.parseFloat(styles.fontSize),
        fontWeight: Number.parseFloat(styles.fontWeight),
        backdrop,
      };
    });
  }, selector);

/**
 * SC 1.4.3 threshold: large-scale text (24px+, or bold 18.66px+) needs 3:1,
 * everything else 4.5:1.
 */
const requiredRatio = ({ fontSize, fontWeight }) =>
  fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;

/** Assert every element matching `selector` meets its SC 1.4.3 threshold. */
const expectReadableText = async (page, selector) => {
  const entries = await readTextStyles(page, selector);
  expect(entries.length, `${selector} matched nothing`).toBeGreaterThan(0);

  for (const entry of entries) {
    const backdrop = parseColor(entry.backdrop);
    // Translucent text is seen as its composite over the backdrop.
    const text = flatten(parseColor(entry.color), backdrop);
    const ratio = contrastRatio(text, backdrop);

    expect(
      ratio,
      `${entry.label}: ${entry.color} on ${entry.backdrop} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(requiredRatio(entry));
  }
};

test.describe('text colour contrast (WCAG 2.2 SC 1.4.3)', () => {
  test('every toolbar control has readable text', async ({ page }) => {
    await expectReadableText(page, '.editor-toolbar button');
  });

  test('editor content text is readable', async ({ page }) => {
    await page.locator(EDITOR).click();
    await page.keyboard.type('Readable body text');

    await expectReadableText(page, `${EDITOR} p`);
  });

  test('the placeholder is readable', async ({ page }) => {
    await expectReadableText(page, '.editor-placeholder');
  });

  test('the word count is readable', async ({ page }) => {
    await expectReadableText(page, '.editor-word-count');
  });

  test('code block and inline code text are readable on their backgrounds', async ({ page }) => {
    const seed = '<p>Uses <code>inline()</code> code</p><pre>const block = true;</pre>';
    await page.goto(`/?seed=${encodeURIComponent(seed)}`);
    await expect(page.locator(EDITOR)).toBeVisible();

    await expectReadableText(page, `${EDITOR} .editor-text-code`);
    await expectReadableText(page, `${EDITOR} .editor-code-block`);
  });

  test('link text is readable', async ({ page }) => {
    const seed = '<p><a href="https://example.com">a readable link</a></p>';
    await page.goto(`/?seed=${encodeURIComponent(seed)}`);
    await expect(page.locator(EDITOR)).toBeVisible();

    await expectReadableText(page, `${EDITOR} a`);
  });

  test('dialog labels and inputs are readable', async ({ page }) => {
    await page.getByRole('button', { name: 'Insert Link' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expectReadableText(page, '.form-group label');
    await expectReadableText(page, '.form-group input');
  });
});

test.describe('focus indicators', () => {
  // Controls that set `outline: none` and paint their own ring. The editing
  // surface is deliberately absent: it is a text box whose focus indication is
  // the caret, not a ring.
  const CONTROLS = [
    {
      name: 'toolbar button',
      selector: '.editor-toolbar button',
      open: async () => {},
    },
    {
      name: 'link dialog input',
      selector: '.form-group input',
      open: async (page) => {
        await page.getByRole('button', { name: 'Insert Link' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      },
    },
  ];

  for (const { name, selector, open } of CONTROLS) {
    test(`${name} shows a focus indicator that differs from its resting state`, async ({
      page,
    }) => {
      await open(page);
      const control = page.locator(selector).first();
      const resting = await readIndicator(page, selector);

      await control.focus();
      await expect(control).toBeFocused();
      const focused = await settledIndicator(page, selector);

      // Something must visibly change, and it must be a real indicator rather
      // than only a background/color shift that color-blind users may miss.
      expect(focused.outline !== resting.outline || focused.boxShadow !== resting.boxShadow).toBe(
        true,
      );
      expect(indicatorColor(focused)).not.toBeNull();
    });

    test(`${name} focus indicator meets 3:1 contrast (WCAG 2.2 SC 1.4.11)`, async ({ page }) => {
      await open(page);
      const control = page.locator(selector).first();

      await control.focus();
      await expect(control).toBeFocused();
      const focused = await settledIndicator(page, selector);

      const ring = indicatorColor(focused);
      expect(ring).not.toBeNull();

      const backdrop = parseColor(focused.backdrop);
      // A translucent ring is seen as its flattened composite, not its nominal
      // color — this is where a low-alpha ring fails.
      const ratio = contrastRatio(flatten(ring, backdrop), backdrop);

      expect(
        ratio,
        `focus indicator ${focused.boxShadow || focused.outline} on ${focused.backdrop} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
