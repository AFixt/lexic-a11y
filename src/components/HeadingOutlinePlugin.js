// HeadingOutlinePlugin.js
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode } from '@lexical/rich-text';
import { $getNodeByKey, $getRoot } from 'lexical';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { headingLevel, validateHeadingStructure } from '../utils/heading-validation';

// Map a structured warning from validateHeadingStructure to an i18n message
function warningMessage(t, warning) {
  if (warning.type === 'skipped-level') {
    return t('headingSkippedLevel', { from: warning.from, to: warning.to });
  }
  if (warning.type === 'multiple-h1') {
    return t('headingMultipleH1', { count: warning.count });
  }
  return null;
}

export function HeadingOutlinePlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    const readHeadings = (editorState) => {
      editorState.read(() => {
        const found = [];
        $getRoot()
          .getChildren()
          .forEach((node) => {
            if ($isHeadingNode(node)) {
              found.push({
                key: node.getKey(),
                tag: node.getTag(),
                text: node.getTextContent(),
              });
            }
          });
        setHeadings(found);
      });
    };

    // Populate from the current state, then follow updates
    readHeadings(editor.getEditorState());
    return editor.registerUpdateListener(({ editorState }) => readHeadings(editorState));
  }, [editor]);

  // Move the caret to a heading and scroll it into view
  const navigateToHeading = (key) => {
    const element = editor.getElementByKey(key);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
    editor.update(() => {
      const node = $getNodeByKey(key);
      if (node) {
        node.selectStart();
      }
    });
    editor.focus();
  };

  const warnings = validateHeadingStructure(headings)
    .map((warning) => ({ warning, message: warningMessage(t, warning) }))
    .filter((entry) => entry.message);

  return (
    <section className="editor-outline" aria-label={t('documentOutline')}>
      {/* Deliberately not a heading: the panel belongs to a single form control,
          so contributing an <h2> to the host page's heading outline would
          misrepresent the page structure (issue #88). The section's aria-label
          already names the region for assistive technology. */}
      <div className="editor-outline-title">{t('documentOutline')}</div>

      {/* Non-blocking, accessible warnings: announced politely, prefixed with
          a text marker so they are not conveyed by color alone */}
      <div role="status" aria-live="polite" className="editor-outline-warnings">
        {warnings.length > 0 ? (
          <ul>
            {warnings.map(({ warning, message }) => (
              <li
                key={`${warning.type}-${warning.index ?? 'h1'}`}
                className="editor-outline-warning"
              >
                <span aria-hidden="true">⚠ </span>
                {t('headingWarningPrefix')}: {message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {headings.length === 0 ? (
        <p className="editor-outline-empty">{t('outlineEmpty')}</p>
      ) : (
        <nav aria-label={t('documentOutline')}>
          <ul className="editor-outline-list">
            {headings.map((heading) => (
              <li
                key={heading.key}
                className="editor-outline-item"
                style={{ marginLeft: `${(headingLevel(heading.tag) - 1) * 16}px` }}
              >
                <button
                  type="button"
                  className="editor-outline-link"
                  onClick={() => navigateToHeading(heading.key)}
                >
                  <span className="editor-outline-tag">{heading.tag.toUpperCase()}</span>{' '}
                  {heading.text || t('outlineUntitled')}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
