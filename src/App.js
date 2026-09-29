// App.js
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import Editor from './components/Editor';
import './styles/Editor.css';
import i18n from './utils/i18n';

// Demo upload handler: reads the file into a data URL so the upload UI works
// without a backend. A real app would POST the file and return the hosted URL.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Demo accessibility checker: posts the document to the Vite dev server's
// @afixt/afixt-engine endpoint (see vite.config.js). A real app posts to its
// own server, which runs the engine through `dist/afixt-engine.js`. Only the
// dev server has the endpoint, so the static demo build omits the panel.
async function checkWithDevEngine(request) {
  const response = await fetch('/__a11y-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Accessibility check failed: HTTP ${response.status}`);
  }
  return response.json();
}

const accessibilityChecker = import.meta.env.DEV ? checkWithDevEngine : undefined;

// Demo helper: let `?seed=<html>` pre-fill the editor so the initialValue
// behaviour can be exercised in the browser and E2E tests.
function getSeedFromUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return new URLSearchParams(window.location.search).get('seed') || undefined;
}

export default function App() {
  const [content, setContent] = useState('');
  const [outputFormat, setOutputFormat] = useState('html');
  const [initialValue] = useState(getSeedFromUrl);

  return (
    <I18nextProvider i18n={i18n}>
      <div>
        <h1>Lexical Rich Text Editor</h1>
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
          onContentChange={setContent}
          outputFormat={outputFormat}
          onImageUpload={readFileAsDataUrl}
          initialValue={initialValue}
          showOutline
          accessibilityChecker={accessibilityChecker}
        />
        <h2>Output ({outputFormat === 'markdown' ? 'Markdown' : 'HTML'})</h2>
        <pre>{content}</pre>
      </div>
    </I18nextProvider>
  );
}
