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
