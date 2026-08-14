# Use Cases

Every user interaction the editor supports, documented in the
[`@afixt/usecase-runner`](https://www.npmjs.com/package/@afixt/usecase-runner)
YAML DSL so they can be exercised by automation. Generated tests target elements
exclusively through ARIA roles and accessible names — every failure is an
accessibility finding.

## Coverage

| Interaction                                   | Use case                                |
| --------------------------------------------- | --------------------------------------- |
| Focus the editor and type text                | `01-text-entry.uc.yaml`                 |
| Bold / italic / underline / strikethrough     | `02-inline-formatting-toolbar.uc.yaml`  |
| Same formats via Ctrl/Cmd+B / +I / +U         | `03-inline-formatting-keyboard.uc.yaml` |
| Heading levels via toolbar and Ctrl+Alt+[1-6] | `04-headings.uc.yaml`                   |
| Bullet/numbered lists, toolbar + shortcuts    | `05-lists.uc.yaml`                      |
| Insert a link via the accessible dialog       | `06-link-insert.uc.yaml`                |
| Cancel/Escape out of the link dialog          | `07-link-cancel.uc.yaml`                |
| Help overlay open/close, button + Ctrl/Cmd+D  | `08-help-overlay.uc.yaml`               |
| Undo / redo from the keyboard                 | `09-undo-redo.uc.yaml`                  |
| Automated WCAG audits (page + dialog scoped)  | `10-page-audit.uc.yaml`                 |
| Image insert, alt text required               | `11-image-alt-text-required.uc.yaml`    |
| Image marked decorative (`alt=""`) instead    | `12-image-decorative-optout.uc.yaml`    |
| Table insert with a real header row           | `13-table-insert.uc.yaml`               |
| Blockquote, code block, inline code, HR       | `14-block-content.uc.yaml`              |
| Toolbar roving tabindex, arrows, Home/End     | `15-toolbar-roving-focus.uc.yaml`       |
| Word / character count live region            | `16-word-count-live-region.uc.yaml`     |
| Document outline + skipped-heading warning    | `17-document-outline-warnings.uc.yaml`  |
| Markdown shortcuts (`#`, `-`, `>`)            | `18-markdown-shortcuts.uc.yaml`         |

Toolbar toggle state is asserted through `aria-pressed` so each use case also
verifies the control semantics, not just the visual result.

Several of these assert on the accessibility tree rather than on appearance,
which is the point of writing them here rather than as unit tests:

- `12` asserts the decorative image count is **zero** — that is how `alt=""`
  plus `role="presentation"` presents to assistive technology.
- `13` asserts the `columnheader` count, so a header row that is only visually
  bold fails.
- `17` asserts the outline is a named list and contributes **no** landmark, so
  the panel cannot start restructuring the host page.
- `18` asserts markdown shortcuts produce real headings and lists, not text that
  merely looks like them.

## Not covered, and why

**Paste sanitization and paste-as-plain-text (`Ctrl/Cmd+Shift+V`).** The editor
sanitizes markup pasted from Word and Google Docs, and `Ctrl/Cmd+Shift+V` forces
a plain-text paste. Neither can be expressed here: the `@afixt/usecase-runner`
DSL (v1.5.1) has no clipboard or paste verb, and faking one through raw
`keyboard:` steps would not populate `clipboardData`, so the template would pass
without ever exercising `PastePlugin`. A template that cannot fail is worse than
none. This is a candidate for an upstream `paste:` keyword rather than a
workaround — see #104. Paste behaviour is covered by the Jest suite in the
meantime.

## Accessible names these depend on

Use cases address controls by accessible name, all defined in
`src/utils/i18n.js`:

- `Editor content` — the editor surface's `aria-label` (`editorContent`).
- `Editor Toolbar` — the toolbar's `aria-label` (`editorToolbar`).
- `Bullet List`, `Numbered List`, `Show Help` — `bulletList` / `numberedList` /
  `showHelp`.
- `Insert Link` — the link button's `aria-label` (`insertLink`).
- `Undo`, `Redo`, `Blockquote`, `Inline Code`, `Code Block`, `Clear Formatting`,
  `Insert Horizontal Rule`, `Insert Image`, `Insert Table` — the remaining
  toolbar `aria-label`s.
- `H1`–`H6` — the heading buttons are labelled with the short form, **not**
  "Heading 1". Getting this wrong produces a template that validates cleanly and
  then fails to locate anything at run time.
- `Alt Text`, `URL`, `Rows`, `Columns` — dialog field labels.
- `Include header row`, `This image is decorative (no alt text needed)` — the
  two dialog checkboxes, addressed by their full visible label.
- `Document Outline` — the outline list's `aria-label`.

These all resolve on `develop` today, verified against `src/utils/i18n.js`. A
use case that fails to locate one of these controls therefore means the
accessible name has regressed.

## Running them

The runner is not a dependency of this package; install it where you want to
execute the use cases (Node >= 22):

```bash
npm install --no-save @afixt/usecase-runner @playwright/test
npx playwright install chromium

# Start the demo app in another shell — it must be reachable at
# http://localhost:4001, the `start_location` every use case declares
npm start

# Validate the YAML
npx usecase-runner validate usecases/*.uc.yaml

# Generate Playwright tests and run them
npx usecase-runner generate usecases/*.uc.yaml --outdir ./tests/generated --run
```

All eighteen use cases in this directory pass `npx usecase-runner validate`
(v1.5.1).
