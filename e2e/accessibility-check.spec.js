// accessibility-check.spec.js — the in-context Accessibility check (issue #155)
// against the REAL @afixt/afixt-engine: the Vite dev server's /__a11y-check
// endpoint (vite.config.js) runs the engine through dist-bound
// src/afixt-engine.js, exactly as a host server would.
//
// The first check launches the engine's headless browser, so those tests get a
// generous timeout.
import { expect, test } from '@playwright/test';

const EDITOR = '.editor-input';
const ENGINE_TIMEOUT = 90_000;

const openSeeded = async (page, html) => {
  await page.goto(`/?seed=${encodeURIComponent(html)}`);
  await expect(page.locator(EDITOR)).toBeVisible();
};

const status = (page) => page.locator('.editor-a11y-check-status');
const runButton = (page) => page.getByRole('button', { name: 'Check accessibility' });

test.describe('accessibility check with afixt-engine', () => {
  test.describe.configure({ timeout: ENGINE_TIMEOUT * 2 });

  test('finds a skipped heading level, marks it, and moves the caret to it', async ({ page }) => {
    await openSeeded(page, '<h1>Report</h1><h4>Skipped a level</h4><p>Body text.</p>');

    await runButton(page).click();
    await expect(status(page)).toContainText('Checking accessibility');
    await expect(status(page)).toContainText(/\d+ accessibility issues? found/, {
      timeout: ENGINE_TIMEOUT,
    });

    const list = page.getByRole('list', { name: 'Accessibility issues' });
    const item = list.getByRole('listitem').filter({ hasText: /heading/i });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('severity');

    // The flagged heading is outlined in place; nothing else is.
    const heading = page.locator(`${EDITOR} h4`);
    await expect(heading).toHaveAttribute('data-lexic-a11y-issue', 'true');
    await expect(page.locator(`${EDITOR} h1`)).not.toHaveAttribute('data-lexic-a11y-issue');

    // "Show in content" names the issue it belongs to via aria-describedby.
    const show = item.getByRole('button', { name: 'Show in content' });
    await expect(show).toHaveAccessibleDescription(/heading/i);
    await show.click();

    await expect(page.locator(EDITOR)).toBeFocused();
    await expect(heading).toHaveAttribute('data-lexic-a11y-issue', 'active');
    const caretInHeading = await page.evaluate(() =>
      Boolean(window.getSelection().anchorNode?.parentElement?.closest('h4')),
    );
    expect(caretInHeading).toBe(true);

    // Editing invalidates the results rather than leaving stale marks.
    await page.keyboard.type('Now ');
    await expect(status(page)).toContainText('The content has changed since the last check');
    await expect(page.locator('[data-lexic-a11y-issue]')).toHaveCount(0);
    // The marks never reach the serialized output.
    await expect(page.locator('pre')).not.toContainText('data-lexic-a11y');
  });

  test('reports a clean document as clean', async ({ page }) => {
    await openSeeded(page, '<h1>Report</h1><h2>Section</h2><p>Body text.</p>');

    await runButton(page).click();
    await expect(status(page)).toContainText('No accessibility issues found', {
      timeout: ENGINE_TIMEOUT,
    });
    await expect(page.getByRole('list', { name: 'Accessibility issues' })).toHaveCount(0);
  });

  test('is operable from the keyboard alone', async ({ page }) => {
    await openSeeded(page, '<h1>Report</h1><h4>Skipped a level</h4>');

    await runButton(page).focus();
    await page.keyboard.press('Enter');
    // aria-disabled, not disabled: focus stays on the button while it runs.
    await expect(runButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(runButton(page)).toBeFocused();
    await expect(status(page)).toContainText(/\d+ accessibility issues? found/, {
      timeout: ENGINE_TIMEOUT,
    });
    await expect(runButton(page)).not.toHaveAttribute('aria-disabled');

    // Reading order: the issue's "How to fix" disclosure, then its actions.
    await page.keyboard.press('Tab');
    await expect(page.locator('.editor-a11y-check-fix summary').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.editor-a11y-check-fix').first()).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Show in content' }).first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(EDITOR)).toBeFocused();
  });
});

test.describe('accessibility check failure handling', () => {
  test('a failed check is reported without losing focus', async ({ page }) => {
    await page.route('**/__a11y-check', (route) => route.fulfill({ status: 500, body: '' }));
    await openSeeded(page, '<p>Anything.</p>');

    await runButton(page).click();
    await expect(status(page)).toContainText('could not be completed');
    await expect(runButton(page)).toBeFocused();
    await expect(page.locator('[data-lexic-a11y-issue]')).toHaveCount(0);
  });
});
