// sample-content.js
// Trusted HTML used to seed the feature-tour editor on mount via the Editor's
// `initialValue` prop. It exercises every block type the editor supports so the
// demo is populated out of the box instead of starting empty:
// headings, blockquote, ordered/unordered lists, a table with a header row,
// an image with alt text, inline code, a fenced code block, and a horizontal
// rule. Because it is passed to `initialValue` (not pasted), it is treated as
// trusted host content and converted faithfully without the paste sanitizer.

export const SAMPLE_CONTENT = `
  <h1>Accessible rich-text editing</h1>
  <p>
    This editor is built on <a href="https://lexical.dev">Lexical</a> with a
    focus on accessibility: every toolbar control is keyboard reachable, the
    document <strong>outline</strong> and live <em>word count</em> update as you
    type, and the generated markup stays clean.
  </p>

  <h2>Formatting you can use</h2>
  <p>
    Mix <strong>bold</strong>, <em>italic</em>, <u>underline</u>, and
    <s>strikethrough</s> inline, or drop in <code>inline code</code> for short
    snippets.
  </p>

  <blockquote>
    Accessibility is not a feature, it is a baseline. Content that everyone can
    read, navigate, and edit is simply better content.
  </blockquote>

  <h2>Lists</h2>
  <p>Unordered, for things without an order:</p>
  <ul>
    <li>Keyboard-navigable toolbar (roving tabindex)</li>
    <li>ARIA roles and labels on interactive controls</li>
    <li>Markdown shortcuts while you type</li>
  </ul>
  <p>Ordered, for steps in sequence:</p>
  <ol>
    <li>Place the caret where you want to edit</li>
    <li>Use the toolbar or a keyboard shortcut</li>
    <li>Watch the HTML / Markdown output update below</li>
  </ol>

  <h2>Tables</h2>
  <p>Tables carry a real header row, exported with <code>scope="col"</code>:</p>
  <table>
    <thead>
      <tr>
        <th>Shortcut</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Ctrl/Cmd + B</td>
        <td>Bold</td>
      </tr>
      <tr>
        <td>Ctrl/Cmd + K</td>
        <td>Insert link</td>
      </tr>
    </tbody>
  </table>

  <h2>Images</h2>
  <p>Images require alt text so they are described to assistive technology:</p>
  <img
    src="https://placehold.co/480x180/4361ee/ffffff?text=Lexic-a11y"
    alt="Lexic-a11y banner placeholder"
  />

  <h2>Code blocks</h2>
  <p>Fenced blocks keep their formatting:</p>
  <pre><code>import Editor from '@afixt/lexic-a11y';

function App() {
  return &lt;Editor onContentChange={console.log} /&gt;;
}</code></pre>

  <hr />

  <p>
    Everything above is editable. Clear it and start your own document, or use
    the &ldquo;Try this&rdquo; panel for shortcuts and Markdown triggers.
  </p>
`;
