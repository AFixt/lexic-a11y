# Lexical A11y Editor Demo

This sandbox is a **simplified, standalone** demo of lexic-a11y, an accessible
rich text editor built with React and Lexical.

It deliberately does **not** import the published package. It rebuilds a small
subset of the editor from Lexical directly (see `src/App.js` and
`src/ToolbarPlugin.js`) so that CodeSandbox can run it without building the
library first. For the full feature set — tables, images, code blocks,
horizontal rules, the link dialog, the document outline, word count, paste
sanitization, and the complete keyboard shortcut map — run `npm run example`
from the repository root.

## Features Showcased

- Accessible rich text editor with keyboard support
- Text formatting (bold, italic, underline, strikethrough)
- Heading formatting (H1, H2, H3) and a Paragraph reset, via toolbar buttons
- List support (ordered and unordered)
- Proper ARIA attributes and accessibility features
- i18n support with react-i18next
- HTML output display

## Getting Started

The editor is ready to use! You can:

1. Type in the editor
2. Use the toolbar for formatting
3. See the generated HTML output below
4. Try the keyboard shortcuts Lexical provides natively:
   - Bold: Ctrl/Cmd+B
   - Italic: Ctrl/Cmd+I
   - Underline: Ctrl/Cmd+U

   The heading, list, and link shortcuts (`Ctrl/Cmd+Alt+[1-6]`,
   `Ctrl/Cmd+Shift+7`/`8`, `Ctrl/Cmd+K`, …) are registered by the full package's
   `ToolbarPlugin` and are **not** wired up in this sandbox — use the toolbar
   buttons here, or run the local feature-tour example for the whole shortcut
   map.

## About lexic-a11y

lexic-a11y provides an accessible, internationalized rich text editor built with
React and Lexical, published as
[`@afixt/lexic-a11y`](https://www.npmjs.com/package/@afixt/lexic-a11y).

For more information, visit the
[full repository](https://github.com/AFixt/lexic-a11y).
