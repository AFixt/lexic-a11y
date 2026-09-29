// theme-contrast.spec.js — rendered contrast of every toolbar state, the
// dialogs and the word count, in both colour themes (issue #154).
//
// Each theme is exercised the ways a host can reach it: the automatic dark set
// under `prefers-color-scheme: dark`, the explicit `data-theme="dark"` opt-in,
// and `data-theme="light"` pinning the light set on a dark OS. Thresholds are
// WCAG 2.2: text 4.5:1 (1.4.3); icons, state-carrying borders and focus rings
// 3:1 (1.4.11).
//
// Reduced motion is emulated so the toolbar's `transition: all 0.2s` is off
// (the stylesheet routes every transition through --transition, which that
// preference zeroes) and each read sees the settled colour, not a mid-fade.
import { expect, test } from '@playwright/test';

import { contrastRatio, expectPaintContrast, expectReadableText, parseColor } from './contrast.js';

const EDITOR = '.editor-input';
const TEXT = 4.5;
const NON_TEXT = 3;

const THEMES = [
  { name: 'light', colorScheme: 'light', dataTheme: null, dark: false },
  { name: 'dark via prefers-color-scheme', colorScheme: 'dark', dataTheme: null, dark: true },
  { name: 'dark via data-theme', colorScheme: 'light', dataTheme: 'dark', dark: true },
  { name: 'light pinned on a dark OS', colorScheme: 'dark', dataTheme: 'light', dark: false },
];

/** Background luminance of the editing surface, to prove which set applied. */
const surfaceIsDark = (page) =>
  page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.querySelector('.editor-container'))
      .backgroundColor.match(/\d+/g)
      .map(Number);
    return (r + g + b) / 3 < 128;
  });

for (const theme of THEMES) {
  test.describe(`${theme.name} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme.colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      if (theme.dataTheme) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme.dataTheme);
      }
      await expect(page.locator(EDITOR)).toBeVisible();
    });

    test('applies the expected colour set', async ({ page }) => {
      expect(await surfaceIsDark(page)).toBe(theme.dark);
    });

    test('idle toolbar: text and icons', async ({ page }) => {
      await expectReadableText(page, '.editor-toolbar button');
      await expectPaintContrast(page, '.editor-toolbar button svg', { min: NON_TEXT });
    });

    test('hovered toolbar buttons: text, icon and border', async ({ page }) => {
      const buttons = page.locator('.editor-toolbar button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(10);

      for (let index = 0; index < count; index += 1) {
        const button = buttons.nth(index);
        await button.hover();
        await expectReadableText(page, '.editor-toolbar button:hover');
        if ((await button.locator('svg').count()) > 0) {
          await expectPaintContrast(page, '.editor-toolbar button:hover svg', { min: NON_TEXT });
        }
        // An aria-disabled button deliberately keeps its resting look on hover;
        // its border is not a state indicator.
        if ((await button.getAttribute('aria-disabled')) !== 'true') {
          await expectPaintContrast(page, '.editor-toolbar button:hover', {
            property: 'border-top-color',
            behind: 'parent',
            min: NON_TEXT,
          });
        }
      }
    });

    test('pressed toolbar buttons: text, icon and border', async ({ page }) => {
      await page.locator(EDITOR).click();
      await page.keyboard.type('Pressed state');
      await page.keyboard.press('ControlOrMeta+a');
      await page.getByRole('button', { name: 'Bold' }).click();
      await page.getByRole('button', { name: 'H1' }).click();
      // Move the pointer off so the pressed style is measured, not hover.
      await page.mouse.move(0, 0);

      // Bold and H1 both report aria-pressed.
      await expect(page.locator('.editor-toolbar button[aria-pressed="true"]')).toHaveCount(2);
      await expect(page.locator('.editor-toolbar button.active')).not.toHaveCount(0);

      const pressed = '.editor-toolbar button[aria-pressed="true"], .editor-toolbar button.active';
      await expectReadableText(page, pressed);
      await expectPaintContrast(page, '.editor-toolbar button[aria-pressed="true"] svg', {
        min: NON_TEXT,
      });
      await expectPaintContrast(page, pressed, {
        property: 'border-top-color',
        behind: 'parent',
        min: NON_TEXT,
      });
    });

    test('focused toolbar buttons: text and focus ring', async ({ page }) => {
      const buttons = page.locator('.editor-toolbar button');
      const count = await buttons.count();

      for (let index = 0; index < count; index += 1) {
        await buttons.nth(index).focus();
        await expectReadableText(page, '.editor-toolbar button:focus');
        await expectPaintContrast(page, '.editor-toolbar button:focus', {
          property: 'box-shadow',
          behind: 'parent',
          min: NON_TEXT,
        });
      }
    });

    test('disabled toolbar buttons keep a legible icon', async ({ page }) => {
      // Undo and redo start disabled on an empty document. Disabled controls
      // are exempt from 1.4.11; this holds them to it anyway.
      await expect(page.locator('.editor-toolbar button[aria-disabled="true"]')).toHaveCount(2);
      await expectPaintContrast(page, '.editor-toolbar button[aria-disabled="true"] svg', {
        min: NON_TEXT,
      });
    });

    test('link dialog: labels, fields, errors and buttons', async ({ page }) => {
      await page.getByRole('button', { name: 'Insert Link' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await expectReadableText(page, '.link-dialog h2');
      await expectReadableText(page, '.form-group label');
      await expectPaintContrast(page, '.form-group input', {
        property: 'border-top-color',
        behind: 'parent',
        min: NON_TEXT,
      });
      await expectReadableText(page, '.cancel-button');
      // Insert is disabled until the URL is valid — exempt, but still legible.
      await expect(page.locator('.insert-button')).toBeDisabled();
      await expectReadableText(page, '.insert-button');

      const placeholder = await page.evaluate(() => {
        const input = document.querySelector('#link-url');
        return {
          color: getComputedStyle(input, '::placeholder').color,
          background: getComputedStyle(input).backgroundColor,
        };
      });
      expect(
        contrastRatio(parseColor(placeholder.color), parseColor(placeholder.background)),
      ).toBeGreaterThanOrEqual(TEXT);

      await page.locator('#link-url').fill('javascript:alert(1)');
      await expect(page.locator('.link-dialog-error')).toBeVisible();
      await expectReadableText(page, '.link-dialog-error');

      await page.locator('#link-url').fill('https://example.com');
      await expectReadableText(page, '.form-group input');
      await expect(page.locator('.insert-button')).toBeEnabled();
      await expectReadableText(page, '.insert-button');
      await page.locator('.insert-button').hover();
      await expectReadableText(page, '.insert-button');
      await page.locator('.cancel-button').hover();
      await expectReadableText(page, '.cancel-button');
    });

    test('image dialog: drop zone and upload button', async ({ page }) => {
      await page.getByRole('button', { name: 'Insert Image' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await expectReadableText(page, '.link-dialog h3');
      await expectReadableText(page, '.image-dropzone-hint');
      await expectReadableText(page, '.upload-button');
      await page.locator('.upload-button').hover();
      await expectReadableText(page, '.upload-button');

      // The drag-over state repaints the drop zone.
      await page.locator('.image-dropzone').dispatchEvent('dragover');
      await expect(page.locator('.image-dropzone.dragover')).toBeVisible();
      await expectReadableText(page, '.image-dropzone-hint');
    });

    test('keyboard shortcuts overlay', async ({ page }) => {
      await page.locator(EDITOR).click();
      await page.keyboard.press('ControlOrMeta+d');
      await expect(page.locator('.editor-docs-content')).toBeVisible();

      await expectReadableText(page, '.editor-docs-content h2');
      await expectReadableText(page, '.editor-docs-content h3');
      await expectReadableText(page, '.editor-docs-content dd');
      await expectReadableText(page, '.editor-docs-content kbd');
      await expectReadableText(page, '.editor-docs-platform-note');
      await expectReadableText(page, '.close-docs-button');
    });

    test('word count, placeholder and outline', async ({ page }) => {
      await expectReadableText(page, '.editor-word-count');
      await expectReadableText(page, '.editor-placeholder');

      await page.locator(EDITOR).click();
      await page.keyboard.type('Outline entry');
      await page.getByRole('button', { name: 'H2' }).click();
      await expectReadableText(page, '.editor-outline-title');
      await expectReadableText(page, '.editor-outline-link');
    });

    test('content: text, headings, links, code and tables', async ({ page }) => {
      const seed =
        '<h2>Heading</h2><p>Body with <a href="https://example.com">a link</a> and ' +
        '<code>inline()</code></p><pre>const block = true;</pre>' +
        '<table><tr><th>Head</th></tr><tr><td>Cell</td></tr><tr><td>Zebra</td></tr></table>';
      await page.goto(`/?seed=${encodeURIComponent(seed)}`);
      if (theme.dataTheme) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme.dataTheme);
      }
      await expect(page.locator(EDITOR)).toBeVisible();

      await expectReadableText(page, `${EDITOR} h2`);
      await expectReadableText(page, `${EDITOR} p`);
      await expectReadableText(page, `${EDITOR} a`);
      await expectReadableText(page, `${EDITOR} .editor-text-code`);
      await expectReadableText(page, `${EDITOR} .editor-code-block`);
      await expectReadableText(page, `${EDITOR} th`);
      await expectReadableText(page, `${EDITOR} td`);
    });
  });
}
