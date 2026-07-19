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

Toolbar toggle state is asserted through `aria-pressed` so each use case also
verifies the control semantics, not just the visual result.

## Accessible names these depend on

Use cases address controls by accessible name, all defined in
`src/utils/i18n.js`:

- `Editor content` — the editor surface's `aria-label` (`editorContent`).
- `Bullet List`, `Numbered List`, `Show Help` — `bulletList` / `numberedList` /
  `showHelp`.
- `Insert Link` — the link button's `aria-label` (`insertLink`).

These all resolve on `develop` today. A use case that fails to locate one of
these controls therefore means the accessible name has regressed.

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

All ten use cases in this directory pass `npx usecase-runner validate` (v1.4.1).
