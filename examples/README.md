# Examples

A single, canonical feature-tour example for **lexic-a11y**. It imports the
editor directly from `../src`, so it always reflects the current source — there
is no pre-built bundle to rebuild and no stale-bundle trap.

## Running

From the repository root:

```bash
npm run example
```

This starts the Vite dev server and opens
<http://localhost:4001/examples/index.html>. Source edits hot-reload.

## What it demonstrates

The editor is seeded on mount (via the `initialValue` prop) with content that
exercises every block type:

- Headings (one `h1` plus several `h2`s) — feeding the live document outline
- Blockquote
- Ordered and unordered lists
- A table with a real header row (exported with `scope="col"`)
- An image with alt text
- Inline code and a fenced code block
- A horizontal rule

Alongside the editor it shows:

- An **output-format toggle** (clean HTML or Markdown) wired to `outputFormat`
- A demo **image upload** handler (`onImageUpload`) that reads files to data
  URLs so the upload UI works without a backend
- The **heading outline** and live **word count** rendered inside the editor
  frame
- A **"Try this"** panel listing keyboard shortcuts (including `Ctrl/Cmd + K`
  link dialog, `Ctrl/Cmd + Shift + V` plain-text paste, and arrow-key toolbar
  navigation) and Markdown triggers (`#`, `>`, `-`, `1.`, `**bold**`, …)
- A **paste-sanitization** walkthrough — paste formatted content from Word or
  Google Docs and watch the cleaned markup appear in the live output

## Files

| File                | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `index.html`        | Vite HTML entry; mounts `main.jsx` into `#root`               |
| `main.jsx`          | React entry point                                             |
| `FeatureTour.jsx`   | The example component (editor + output + "Try this" panel)    |
| `sample-content.js` | Trusted seed HTML passed to the editor's `initialValue`       |
| `example.css`       | Layout for the example page (not part of the shipped package) |

## Embedding the editor in your own app

```jsx
import Editor from '@afixt/lexic-a11y';

function MyApp() {
  return (
    <Editor
      initialValue="<p>Optional trusted starting HTML</p>"
      outputFormat="html" // or "markdown"
      onContentChange={(serialized) => console.log(serialized)}
      onImageUpload={async (file) => uploadAndReturnUrl(file)}
    />
  );
}
```

See `FeatureTour.jsx` for a complete, working integration.
