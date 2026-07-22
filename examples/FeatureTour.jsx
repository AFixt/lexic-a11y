// FeatureTour.jsx
// The single canonical example for lexic-a11y. It imports the Editor straight
// from `../src` (no build step, so it always reflects the current source) and
// seeds it with rich sample content so every feature is visible on load:
// headings, blockquote, lists, a table with a header row, an image with alt
// text, inline + block code, and a horizontal rule. Alongside the editor it
// shows the live serialized output, an output-format toggle, and a "Try this"
// panel documenting keyboard shortcuts and Markdown triggers.
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import Editor from '../src/components/Editor';
import '../src/styles/Editor.css';
import i18n from '../src/utils/i18n';

import './example.css';
import { SAMPLE_CONTENT } from './sample-content';

// Demo upload handler: reads the file into a data URL so the image-upload UI
// works without a backend. A real app would POST the file and return a hosted
// URL from its own storage.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const SHORTCUTS = [
  ['Ctrl/Cmd + B', 'Bold'],
  ['Ctrl/Cmd + I', 'Italic'],
  ['Ctrl/Cmd + U', 'Underline'],
  ['Ctrl/Cmd + K', 'Insert / edit link'],
  ['Ctrl/Cmd + Z', 'Undo'],
  ['Ctrl/Cmd + Shift + Z', 'Redo'],
  ['Ctrl/Cmd + Shift + V', 'Paste as plain text'],
  ['Left / Right arrows', 'Move between toolbar buttons'],
];

const MARKDOWN_TRIGGERS = [
  ['# ', 'Heading 1 (use ##, ### for H2/H3)'],
  ['> ', 'Blockquote'],
  ['- ', 'Bulleted list'],
  ['1. ', 'Numbered list'],
  ['**bold**', 'Bold'],
  ['*italic*', 'Italic'],
  ['`code`', 'Inline code'],
  ['``` ', 'Code block'],
  ['---', 'Horizontal rule'],
];

export default function FeatureTour() {
  const [content, setContent] = useState('');
  const [outputFormat, setOutputFormat] = useState('html');

  return (
    <I18nextProvider i18n={i18n}>
      <main className="example-page">
        <header>
          <h1>lexic-a11y feature tour</h1>
          <p>
            An accessible, Lexical-based rich-text editor. The editor below is seeded with sample
            content exercising every block type. Edit it, paste from another app, or clear it and
            start your own document — the serialized output updates live underneath.
          </p>
        </header>

        <fieldset className="output-format-control">
          <legend>Output format</legend>
          <label>
            <input
              type="radio"
              name="output-format"
              value="html"
              checked={outputFormat === 'html'}
              onChange={(e) => setOutputFormat(e.target.value)}
            />{' '}
            HTML
          </label>
          <label>
            <input
              type="radio"
              name="output-format"
              value="markdown"
              checked={outputFormat === 'markdown'}
              onChange={(e) => setOutputFormat(e.target.value)}
            />{' '}
            Markdown
          </label>
        </fieldset>

        <Editor
          initialValue={SAMPLE_CONTENT}
          onContentChange={setContent}
          outputFormat={outputFormat}
          onImageUpload={readFileAsDataUrl}
          showOutline
        />

        <p className="example-hint">
          The heading <strong>outline</strong> and live <strong>word count</strong> render inside
          the editor frame above and update as you type. The toolbar&rsquo;s <kbd>?</kbd> button
          opens the full built-in shortcut reference.
        </p>

        <section className="try-this" aria-labelledby="try-this-heading">
          <h2 id="try-this-heading">Try this</h2>
          <div className="try-this-columns">
            <section aria-labelledby="shortcuts-heading">
              <h3 id="shortcuts-heading">Keyboard shortcuts</h3>
              <dl className="kv-list">
                {SHORTCUTS.map(([keys, action]) => (
                  <div className="kv-row" key={keys}>
                    <dt>
                      <kbd>{keys}</kbd>
                    </dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="markdown-heading">
              <h3 id="markdown-heading">Markdown shortcuts</h3>
              <p className="kv-intro">Type these at the start of a line (or inline):</p>
              <dl className="kv-list">
                {MARKDOWN_TRIGGERS.map(([trigger, action]) => (
                  <div className="kv-row" key={trigger}>
                    <dt>
                      <code>{trigger}</code>
                    </dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section aria-labelledby="paste-heading" className="paste-demo">
            <h3 id="paste-heading">See paste sanitization</h3>
            <p>
              Copy a few formatted paragraphs from Word, Google Docs, or a web page and paste them
              into the editor. Pasted markup is stripped of inline styles, classes, and unsafe URLs
              before it is inserted — watch the cleaned result appear in the output below. Use{' '}
              <kbd>Ctrl/Cmd + Shift + V</kbd> to paste as plain text instead.
            </p>
          </section>
        </section>

        <section aria-labelledby="output-heading" className="output-container">
          <h2 id="output-heading">
            Live output ({outputFormat === 'markdown' ? 'Markdown' : 'HTML'})
          </h2>
          <pre className="html-output" tabIndex={0}>
            {content || 'Start editing to see the serialized output.'}
          </pre>
        </section>
      </main>
    </I18nextProvider>
  );
}
