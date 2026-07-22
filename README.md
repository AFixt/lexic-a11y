# lexic-a11y: An accessible Lexical Rich Text Editor Package

An accessible and internationalized rich text editor built with React and
Lexical. This package provides a modular editor focused on accessibility that
supports core formatting options. It is designed to be easily integrated into
any React application and to serve as a reusable component for projects
requiring high accessibility (WCAG compliant) text editing capabilities.

## Overview

lexic-a11y is a self-contained, React-based editor that emphasizes
accessibility, extensibility, and internationalization. It leverages the modern
Lexical framework by Meta to provide a headless editing experience that can be
easily extended and customized. Designed with WCAG-compliant practices in mind,
it provides keyboard shortcuts and accessibility features that make rich text
editing more accessible to all users.

## What It Does

- Rich Text Editing: Offers essential text formatting including bold, italic,
  underline, strikethrough, inline code, and a full range of headings (H1–H6).
- Block Content: Blockquotes, fenced code blocks, horizontal rules, tables with
  a real header row, and images that require alt text (or an explicit
  "decorative" opt-out).
- List Support: Create and manage ordered and unordered lists with proper
  semantic structure.
- Link Management: Insert and edit hyperlinks with an accessible dialog
  interface, with URL scheme validation that rejects unsafe protocols.
- Markdown Shortcuts: Type `#`, `>`, `-`, `1.`, `**bold**`, and friends to
  format as you go; content can also be serialized to Markdown.
- Live Document Outline: Opt in with `showOutline` for a running list of the
  document's headings, with WCAG-aligned warnings for skipped heading levels and
  multiple H1s. It is a labelled region rather than a heading, so it never
  contributes to the host page's heading outline.
- Word and Character Count: Debounced counts surfaced in a polite live region.
- Paste Sanitization: Pasted markup from Word or Google Docs is cleaned to
  semantic HTML; Ctrl/Cmd+Shift+V pastes as plain text.
- Keyboard Shortcuts: Implements a variety of keyboard shortcuts for quick
  formatting actions (e.g., Ctrl/Cmd+B for bold, Ctrl/Cmd+Alt+1 for Heading 1)
  and efficient navigation.
- Documentation: Provides an overlay with available keyboard shortcuts and usage
  tips (Ctrl/Cmd+D).
- Internationalization (i18n): Integrated with react-i18next to allow
  localization of toolbar labels and prompts, making it adaptable for
  multi-language projects.
- Accessibility: Designed with accessibility in mind, including ARIA roles,
  keyboard navigability, and semantic output to ensure compliance with WCAG
  standards.

## Features

- Core Formatting Options:
  - Text Styling: Bold, Italic, Underline, Strikethrough, inline code.
  - Headings: H1 through H6 with both toolbar buttons and keyboard shortcuts.
- List Formatting:
  - Ordered Lists: Create numbered lists with proper semantic structure.
  - Unordered Lists: Create bullet lists with proper semantic structure.
- Content Elements:
  - Links: Insert and edit hyperlinks with an accessible dialog.
  - Images: Insert by URL, or via the optional `onImageUpload` handler with a
    drag-and-drop zone and file picker. Alt text is required before the image
    can be inserted, unless it is explicitly marked decorative (`alt=""`).
  - Tables: Insert with a header row; exported with `scope="col"`.
  - Blockquotes, fenced code blocks, and horizontal rules.
- Output Formats:
  - Clean HTML (utility classes and Lexical's sizing markup stripped) or
    Markdown, selected with the `outputFormat` prop.
- Internationalization (i18n):
  - Built-in support using react-i18next.
  - Easy to add new languages and localize toolbar and prompt texts.
- Accessibility (WCAG Compliant):
  - ARIA roles and labels throughout the UI.
  - Fully keyboard accessible, including a roving-tabindex toolbar.
  - Semantic HTML output for screen readers and other assistive technologies.

### Keyboard shortcuts

On macOS use <kbd>Cmd</kbd> wherever <kbd>Ctrl</kbd> is shown. The same list is
available in-app from the help overlay (<kbd>Ctrl</kbd>+<kbd>D</kbd>).

| Shortcut             | Action                    |
| -------------------- | ------------------------- |
| `Ctrl+B` / `I` / `U` | Bold / Italic / Underline |
| `Ctrl+Shift+X`       | Strikethrough             |
| `Ctrl+E`             | Inline code               |
| `Ctrl+Shift+E`       | Code block                |
| `Ctrl+\`             | Clear formatting          |
| `Ctrl+Alt+[1–6]`     | Heading 1–6               |
| `Ctrl+Shift+7`       | Ordered (numbered) list   |
| `Ctrl+Shift+8`       | Unordered (bullet) list   |
| `Ctrl+Shift+Q`       | Blockquote                |
| `Ctrl+K`             | Insert / edit link        |
| `Ctrl+Shift+M`       | Insert image              |
| `Ctrl+Shift+L`       | Insert table              |
| `Ctrl+Shift+-`       | Horizontal rule           |
| `Ctrl+Shift+V`       | Paste as plain text       |
| `Ctrl+D`             | Toggle the help overlay   |
| `Escape`             | Close the open dialog     |

The toolbar is a single tab stop with arrow-key roving focus; `Home` and `End`
jump to the first and last control.

## Installation

### Prerequisites

- Node.js — `package.json` requires v20+, but the repo pins **v22** in `.nvmrc`
  / `.node-version` (and CI runs `lts/*`). Use 22: the `@afixt/a11y-assert` test
  dependency declares `engines.node >= 22`.
- npm v10+ (enforced via `engine-strict=true` in `.npmrc`)
- React (v16.8+, v17.0.0+, or v18.0.0+ for Hooks support)
- Homebrew (macOS/Linux) — used by the bootstrap script to install security
  binaries (`trufflehog`, `osv-scanner`, `semgrep`, `lychee`)

### Steps

1. Clone the Repository:

```bash
git clone https://github.com/AFixt/lexic-a11y.git
cd lexic-a11y
```

1. Bootstrap (installs required Homebrew binaries and npm deps):

```bash
bash scripts/bootstrap.sh
```

Or, if you already have the security binaries installed, run the plain install:

```bash
npm install
```

1. Build the Package:

If you plan to reuse this package in other projects, you can build it as a
library:

```bash
npm run build
```

This will generate a bundled version of the editor that can be imported into
your projects.

## Usage

### Integration in a React Project

#### 1. Import the Editor Component

In your React application, import the main Editor component:

```javascript
import React, { useState } from 'react';
import Editor from '@afixt/lexic-a11y';
import '@afixt/lexic-a11y/dist/styles.css'; // Import the styles

// Resolve an uploaded File to a hosted URL (POST to your backend in a real app).
async function uploadImage(file) {
  const url = await myBackend.upload(file);
  return url;
}

export default function App() {
  const [content, setContent] = useState('');

  return (
    <div>
      <h1>My Application with Lexical Editor</h1>
      <Editor
        onContentChange={setContent}
        outputFormat="html"
        onImageUpload={uploadImage}
        initialValue="<p>Pre-filled <strong>draft</strong> content.</p>"
        showOutline
      />
      <h2>Output HTML</h2>
      <pre>{content}</pre>
    </div>
  );
}
```

#### Editor props

| Prop              | Type                              | Default  | Description                                                                                                                                                                                                             |
| ----------------- | --------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onContentChange` | `(content: string) => void`       | —        | Called on every edit with the serialized content, in the format chosen by `outputFormat`.                                                                                                                               |
| `outputFormat`    | `'html' \| 'markdown'`            | `'html'` | Format passed to `onContentChange`: cleaned HTML or Markdown. Nodes without a Markdown form (tables, images, horizontal rules, code blocks) are omitted from Markdown output.                                           |
| `onImageUpload`   | `(file: File) => Promise<string>` | —        | Optional. When provided, the Insert Image dialog gains a drag-and-drop zone and file picker; the handler receives the chosen `File` and must resolve to the URL to embed.                                               |
| `initialValue`    | `string`                          | —        | Optional trusted HTML used to seed the editor once, on mount (e.g. a saved draft or template). Images, tables, and code blocks are preserved. Later changes to this prop are ignored so user edits are never clobbered. |
| `showOutline`     | `boolean`                         | `false`  | Whether to render the Document Outline panel below the editing surface. Off by default, which suits short-form embedded fields (a reply box, a ticket description). Pass `true` for long-form authoring.                |

#### Upgrading

Coming from 1.1.x, the Document Outline panel changed in two ways that affect
existing consumers:

- **It no longer renders by default.** It used to always render; it is now
  opt-in. If you want it, pass `showOutline`:

  ```jsx
  <Editor onContentChange={setContent} showOutline />
  ```

- **Its title is a `<div>`, not an `<h2>`.** The panel is a labelled region
  (`<section aria-label="Document Outline">`), so an embedded editor no longer
  injects a heading into the host page's heading hierarchy. Class names
  (`.editor-outline`, `.editor-outline-title`) are unchanged, but CSS that
  selected the title by element — `.editor-outline h2` — needs updating to
  `.editor-outline-title`.

#### TypeScript

The package ships hand-maintained declarations at `dist/index.d.ts` (the source
is JavaScript — see [ADR 0002](./docs/adr/0002-remain-on-javascript.md)). No
`@types/...` package is needed:

```typescript
import Editor, { ToolbarPlugin, i18n } from '@afixt/lexic-a11y';
import type { EditorProps, OutputFormat } from '@afixt/lexic-a11y';
```

`npm run types:check` compiles the declarations under `strict`, and
`src/tests/public-api.test.js` fails if they drift from the library's real
exports.

#### 2. i18n Setup

The package exports its configured `i18next` instance as a **named** export
alongside the default `Editor` export. Wrap your application with an i18n
provider:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@afixt/lexic-a11y';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
```

#### 3. Styling

The CSS is included when you import the styles as shown above. This provides
styling for the toolbar and editor components.

### Customizing the Editor

- **Theme**: Lexical class names for each node type are defined in the `theme`
  object in `src/components/Editor.js`. It is not currently exposed as a prop —
  change it in source (or fork) to rename the classes.
- **Custom Styling**: Customize colors, fonts, and spacing by overriding the CSS
  classes from `dist/styles.css` (built from `src/styles/Editor.css`) to match
  your project's design guidelines.

### Extending the Editor

- **Keyboard Shortcuts**: The shortcuts are registered in
  `src/components/ToolbarPlugin.js` with a document-level `keydown` listener.
  You can modify the key combinations or add new ones as needed. (Bold, italic,
  and underline are deliberately left to Lexical's `RichTextPlugin` — handling
  them again there applies the format twice.)
- **Internationalization**: Update `src/utils/i18n.js` to add additional
  languages or modify existing translations. Use the `useTranslation` hook
  within any component to localize additional UI elements.
- **Adding Features**: The editor ships with images (insert by URL or via the
  optional `onImageUpload` handler), horizontal rules, and tables built in. To
  add further formatting options, follow Lexical's modular architecture to
  create and register new nodes.

## Development

### Running the Editor Locally

To run the editor in a development environment:

1. Start the Development Server:

```bash
npm start
```

This launches the Vite dev server (configured in `vite.config.js`) and opens
<http://localhost:4001> automatically.

1. Making Changes:

- Edit the source files in the /src directory.
- The development server supports hot reloading, so your changes will appear
  automatically.

1. Running the Example Demo:

The repository includes a feature-tour example in `examples/` that imports the
editor straight from `src/` (no build step required) and seeds it with sample
content exercising every block type — headings, blockquote, lists, a table with
a header row, an image with alt text, inline and block code, and a horizontal
rule. It also surfaces a "Try this" panel of keyboard shortcuts and Markdown
triggers, and the live serialized output.

```bash
npm run example
```

This starts the Vite dev server and opens the example at
<http://localhost:4001/examples/index.html>. Because it imports from `src/`,
your edits to the source are reflected immediately with hot reloading — there is
no stale pre-built bundle to rebuild. See
[`examples/README.md`](examples/README.md) for details.

### Try it on CodeSandbox

You can also try the editor directly on CodeSandbox without installing anything
locally:

[![Edit lexic-a11y](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/github/AFixt/lexic-a11y/tree/develop/sandbox)

This opens the `sandbox/` demo. Note that it is a **deliberately simplified,
standalone** rebuild of the editor (bold/italic/underline/strikethrough, H1–H3,
lists) rather than the packaged component — it exists so CodeSandbox can run
without building the library. For the full feature set (tables, images, code
blocks, horizontal rules, the link dialog, and every keyboard shortcut), run
`npm run example` locally.

### End-to-end tests

The E2E suite runs the demo app in a real browser with
[Playwright](https://playwright.dev/). A rich-text editor's correctness is
largely real-browser behavior (keyboard handling, selection, contenteditable
quirks, ARIA state), which Jest unit tests cannot exercise.

```bash
# One-time: install the Playwright browser
npx playwright install chromium

# Run the suite (starts the Vite dev server automatically)
npm run test:e2e

# Debug with a visible browser
npm run test:e2e:headed
```

The suite covers typing, formatting (toolbar and keyboard), lists, the link
dialog, keyboard navigation, and ARIA state assertions. CI runs it on pull
requests via `.github/workflows/e2e.yml`.

### Built-bundle smoke tests

`npm test` imports from `src/`, so it cannot see a bug introduced by the build
itself. `npm run test:dist` mounts the real `dist/` artifacts — both the ESM and
CJS bundles — in jsdom and asserts they render:

```bash
npm run build      # test:dist needs the artifacts
npm run test:dist
```

This guards the class of regression that shipped in v1.1.2, where the bundles
referenced an unbound global `React` and threw `React is not defined` on mount
while the source suite stayed green. `npm run check:all` runs it after `build`.

### Building for Production

Once you are satisfied with your changes, build the package for production:

```bash
npm run build
```

The production-ready files will be output to the /dist directory.

## Contributing

We welcome contributions from the community! If you'd like to contribute:

- **Fork & branch:** Branch off `develop` (`feature/<issue>-<slug>`).
- **Before pushing:** Run `npm run check:all` — this runs lint, tests, build,
  duplication check, bundle size, license compliance, `npm audit`, and
  trufflehog.
- **Commit style:** [Conventional Commits](https://www.conventionalcommits.org/)
  (enforced by commitlint via the `commit-msg` hook).
- **Open issues:** Use the repository's issue tracker for bugs or feature
  requests.

### Available scripts

| Script                         | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `npm start`                    | Start Vite dev server (demo, port 4001)        |
| `npm run example`              | Open the feature-tour example                  |
| `npm run build`                | Build the library (Rollup → `dist/`)           |
| `npm run build:analyze`        | Build with bundle visualizer report            |
| `npm test`                     | Run the Jest test suite                        |
| `npm run test:dist`            | Smoke-test the built bundles (needs `build`)   |
| `npm run test:e2e`             | Run the Playwright E2E suite                   |
| `npm run lint`                 | Run ESLint                                     |
| `npm run lint:css`             | Run Stylelint                                  |
| `npm run lint:md`              | Run markdownlint-cli2                          |
| `npm run types:check`          | Typecheck the published `.d.ts` under `strict` |
| `npm run format`               | Run Prettier (write mode)                      |
| `npm run format:check`         | Run Prettier in check mode                     |
| `npm run dupes`                | Run jscpd duplication check                    |
| `npm run size`                 | Enforce `size-limit` budgets                   |
| `npm run links`                | Check markdown links with `lychee`             |
| `npm run security`             | Run npm audit + OSV + Semgrep + trufflehog     |
| `npm run license:check`        | Verify production dependency licenses          |
| `npm run security:banned-deps` | Fail if a banned package resolves              |
| `npm run check`                | Lint + stylelint + markdown + format + types   |
| `npm run check:all`            | Full local gate (used by the `pre-push` hook)  |

> **Accessibility test tooling:** `npm test` runs automated WCAG assertions via
> [`@afixt/a11y-assert`](https://www.npmjs.com/package/@afixt/a11y-assert), a
> first-party Afixt dev dependency. It declares `engines.node >= 22`, so run the
> test suite on Node 22+ (the version CI uses); Node 20 only emits an
> `EBADENGINE` warning. It is a `devDependency` and is not part of the published
> package or its production `license:check`.
>
> **`axe-core` is banned in this project**, directly and transitively. A
> `package.json` `overrides` entry resolves it to an empty stub so it can never
> be installed, and `npm run security:banned-deps` fails the build naming the
> dependency that asked for it. Before adding a dependency, check it does not
> pull in `axe-core` (`eslint-plugin-jsx-a11y`, `lighthouse`, `pa11y`,
> `jest-axe`, and `cypress-axe` all do). Use `@afixt/a11y-assert` instead.

### Architecture decisions

See [`docs/adr/`](./docs/adr/) for architectural decision records. Use
[`docs/templates/ADR.md`](./docs/templates/ADR.md) to draft new ones.

## License

This project is licensed under the MIT License. See the LICENSE file for more
details.
