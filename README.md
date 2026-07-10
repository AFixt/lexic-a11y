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
  underline, strikethrough, and a full range of headings (H1–H6).
- List Support: Create and manage ordered and unordered lists with proper
  semantic structure.
- Link Management: Insert and edit hyperlinks with an accessible dialog
  interface.
- Keyboard Shortcuts: Implements a variety of keyboard shortcuts for quick
  formatting actions (e.g., Ctrl/Cmd+B for bold, Ctrl/Cmd+Alt+1 for Heading 1)
  and efficient navigation.
- Documentation: Provides an overlay with available keyboard shortcuts and usage
  tips.
- Internationalization (i18n): Integrated with react-i18next to allow
  localization of toolbar labels and prompts, making it adaptable for
  multi-language projects.
- Accessibility: Designed with accessibility in mind, including ARIA roles,
  keyboard navigability, and semantic output to ensure compliance with WCAG
  standards.

## Features

- Core Formatting Options:
  - Text Styling: Bold, Italic, Underline, Strikethrough.
  - Headings: H1 through H6 with both toolbar buttons and keyboard shortcuts.
- List Formatting:
  - Ordered Lists: Create numbered lists with proper semantic structure.
  - Unordered Lists: Create bullet lists with proper semantic structure.
- Content Elements:
  - Links: Insert and edit hyperlinks with an accessible dialog.
- Keyboard Shortcuts:
  - Basic formatting: Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic, Ctrl/Cmd+U for
    underline.
  - Heading shortcuts: Ctrl/Cmd+Alt+[1–6] for H1–H6.
  - List shortcuts: Ctrl/Cmd+Shift+7 for ordered lists, Ctrl/Cmd+Shift+8 for
    unordered lists.
  - Link shortcut: Ctrl/Cmd+K to insert or edit links.
- Documentation:
  - Keyboard Shortcuts Help: Overlay displaying all available keyboard commands.
- Internationalization (i18n):
  - Built-in support using react-i18next.
  - Easy to add new languages and localize toolbar and prompt texts.
- Accessibility (WCAG Compliant):
  - ARIA roles and labels throughout the UI.
  - Fully keyboard accessible.
  - Semantic HTML output for screen readers and other assistive technologies.

## Installation

### Prerequisites

- Node.js (v20+; version pinned in `.nvmrc` / `.node-version`)
- npm v10+ (enforced via `engine-strict=true` in `.npmrc`)
- React (v16.8+, v17.0.0+, or v18.0.0+ for Hooks support)
- Homebrew (macOS/Linux) — used by the bootstrap script to install security
  binaries (`trufflehog`, `osv-scanner`, `semgrep`, `lychee`)

### Steps

1. Clone the Repository:

```bash
git clone https://github.com/eventably/lexic-a11y.git
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

#### 2. i18n Setup

Make sure your project wraps the application with an i18n provider:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nextProvider } from 'react-i18next';
import i18n from '@afixt/lexic-a11y/dist/i18n';

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

- **Theme**: The editor accepts a theme object via the configuration in
  Editor.js that lets you define class names for various parts of the editor.
- **Custom Styling**: Customize colors, fonts, and spacing by overriding the CSS
  classes to match your project's design guidelines.

### Extending the Editor

- **Keyboard Shortcuts**: The shortcuts are registered in ToolbarPlugin.js using
  event listeners. You can modify the key combinations or add new ones as
  needed.
- **Internationalization**: Update the i18n.js file to add additional languages
  or modify existing translations. Use the useTranslation hook within any
  component to localize additional UI elements.
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

This will launch the application in development mode. Open
<http://localhost:3000> to view it in your browser.

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

[![Edit lexic-a11y](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/github/eventably/lexic-a11y/tree/develop/sandbox)

This opens our dedicated sandbox demo where you can interact with the editor and
see how it works.

### End-to-end tests

The E2E suite runs the demo app in a real browser with
[Playwright](https://playwright.dev/) and includes an
[axe](https://github.com/dequelabs/axe-core) accessibility scan. A rich-text
editor's correctness is largely real-browser behavior (keyboard handling,
selection, contenteditable quirks, ARIA state), which Jest unit tests cannot
exercise.

```bash
# One-time: install the Playwright browser
npx playwright install chromium

# Run the suite (starts the Vite dev server automatically)
npm run test:e2e

# Debug with a visible browser
npm run test:e2e:headed
```

The suite covers typing, formatting (toolbar and keyboard), lists, the link
dialog, keyboard navigation, ARIA state assertions, and an axe scan that fails
on serious/critical violations. CI runs it on pull requests via
`.github/workflows/e2e.yml`.

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

| Script                  | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `npm start`             | Start Vite dev server (demo)                  |
| `npm run build`         | Build the library (Rollup → `dist/`)          |
| `npm run build:analyze` | Build with bundle visualizer report           |
| `npm test`              | Run the Jest test suite                       |
| `npm run test:e2e`      | Run the Playwright E2E suite                  |
| `npm run lint`          | Run ESLint                                    |
| `npm run lint:css`      | Run Stylelint                                 |
| `npm run lint:md`       | Run markdownlint-cli2                         |
| `npm run format`        | Run Prettier (write mode)                     |
| `npm run format:check`  | Run Prettier in check mode                    |
| `npm run dupes`         | Run jscpd duplication check                   |
| `npm run size`          | Enforce `size-limit` budgets                  |
| `npm run links`         | Check markdown links with `lychee`            |
| `npm run security`      | Run npm audit + OSV + Semgrep + trufflehog    |
| `npm run license:check` | Verify production dependency licenses         |
| `npm run check`         | Lint + stylelint + markdown + format:check    |
| `npm run check:all`     | Full local gate (used by the `pre-push` hook) |

> **Accessibility test tooling:** `npm test` runs automated WCAG assertions via
> [`@afixt/a11y-assert`](https://www.npmjs.com/package/@afixt/a11y-assert), a
> first-party Afixt dev dependency. It declares `engines.node >= 22`, so run the
> test suite on Node 22+ (the version CI uses); Node 20 only emits an
> `EBADENGINE` warning. It is a `devDependency` and is not part of the published
> package or its production `license:check`.

### Architecture decisions

See [`docs/adr/`](./docs/adr/) for architectural decision records. Use
[`docs/templates/ADR.md`](./docs/templates/ADR.md) to draft new ones.

## License

This project is licensed under the MIT License. See the LICENSE file for more
details.
