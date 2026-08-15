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

- `13` names each header cell and then asserts each is exposed as a
  `columnheader` by its accessible name, so a header row that is only visually
  bold fails.
- `17` asserts the outline is a named list, so a screen-reader user can identify
  what they have landed in.
- `18` asserts markdown shortcuts produce real headings and lists, not text that
  merely looks like them.

Some intended tree assertions cannot be expressed in the runner's current
grammar and are recorded under
[Runner grammar limitations](#runner-grammar-limitations) below rather than
faked into passing.

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

### Runner grammar limitations

`@afixt/usecase-runner` 1.5.1 — the version this suite is pinned to and the
newest published — cannot express a few assertions these use cases want. Rather
than hack them into validating (a template that cannot fail is worse than none),
the expressible half is asserted and the gap is recorded here as a candidate for
an upstream runner feature:

- **Nameless counts** — `count <role> is N`. The `count` verb requires a _named_
  target (`count role "columnheader" name "Name" is 1`), so "count of **all**
  images/columnheaders/landmarks" cannot be written:
  - `12` wants `count image is 0` to prove a decorative image exposes no
    img-role node. It asserts the opt-out mechanics (checkbox checked, alt field
    disabled and no longer required, Insert enabled) and a page audit instead.
  - `13` wants `count columnheader is <columns>`. It names each header cell and
    asserts each named cell is a `columnheader`, which is stronger per-header
    but does not assert the total.
  - `17` wants `count navigation is 0` to prove the outline adds no landmark. It
    asserts the positive half (the outline _is_ a named list) instead.
- **Attribute presence** — `attribute "x" present`. The DSL only has
  `attribute "x" is "y"`, so `11` cannot assert that the alt field is associated
  with a hint via `aria-describedby`; it asserts the hint text the association
  points at is rendered instead.
- **`sr_says` timeouts** — the `within <n>s` clause is not supported; `sr_says`
  already polls the spoken-phrase log, so `16` and `17` drop it.

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

# Validate the YAML (from this repo, the gate script fails on any invalid file)
npm run validate:usecases

# Generate Playwright tests and run them
npx usecase-runner generate usecases/*.uc.yaml --outdir ./tests/generated --run
```

All eighteen use cases in this directory pass validation (runner v1.5.1).

## Validation gate

`npm run validate:usecases` validates every file and is run on each pull request
by the **Validate use cases** job in `.github/workflows/ci.yml`
(`@afixt/usecase-runner` is a `devDependency`, installed with the org
`NPM_TOKEN` like the other private `@afixt` packages). The script validates each
file individually rather than passing the directory, because
`usecase-runner validate <dir>` prints the first error and then exits 0 — a gate
that cannot fail is no gate (#107).
