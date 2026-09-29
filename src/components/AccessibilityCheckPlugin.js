// AccessibilityCheckPlugin.js — run an accessibility checker (normally
// @afixt/afixt-engine on the host's server) against the content, and show what
// it finds in the context of the content itself (issue #155).
//
// Design (the alternatives are recorded in the PR for #155):
// - Checking is on demand, from a button. The engine drives a headless browser
//   and takes seconds, so checking on every keystroke would lag, cost the host
//   real compute, and flood a live region with announcements.
// - Results are a list, one item per finding, each with a "Show in content"
//   button that moves the caret onto the affected content and scrolls it into
//   view. The list is the accessible surface: it is reachable in tab order,
//   reads in order, and hands keyboard and screen-reader users straight to the
//   spot, where the caret lands on the flagged text.
// - The affected content is also outlined in place (a dashed outline plus a
//   marker glyph, so it is not colour alone), and the one being shown is
//   emphasised. These marks are visual only: they are attributes on
//   Lexical's DOM, never nodes, so they cannot leak into the saved content.
// - Any edit clears the marks and flags the results as out of date instead of
//   pretending they still describe the text.
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createNodeSelection,
  $getNodeByKey,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $setSelection,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildCheckDocument, locateIssue, parseCheckDocument } from '../utils/a11y-check-document';

const ISSUE_ATTRIBUTE = 'data-lexic-a11y-issue';

// Per-instance id prefix. Not React's useId: the peer range reaches back to
// React 16.8, which does not have it.
let instanceCount = 0;

/** Remove every in-content mark this plugin set. */
function clearMarks(root) {
  if (!root) return;
  for (const element of root.querySelectorAll(`[${ISSUE_ATTRIBUTE}]`)) {
    element.removeAttribute(ISSUE_ATTRIBUTE);
  }
}

/**
 * Map every rendered node's DOM element to its node key. Built from the public
 * API (walk the tree, ask for each node's element) rather than Lexical's
 * DOM-lookup helper, which needs an active editor that a read-only
 * `editorState.read()` does not provide.
 */
function elementKeys(editor) {
  const keys = new Map();
  editor.getEditorState().read(() => {
    const visit = (node) => {
      const element = editor.getElementByKey(node.getKey());
      if (element) keys.set(element, node.getKey());
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    $getRoot().getChildren().forEach(visit);
  });
  return keys;
}

/** The key of the node that renders `element`, or its nearest ancestor. */
function nearestKey(keys, element) {
  for (let node = element; node; node = node.parentElement) {
    if (keys.has(node)) return keys.get(node);
  }
  return null;
}

/**
 * Pair each finding with the Lexical node it belongs to. Findings on the
 * editor's own wrapper are dropped (see `locateIssue`).
 */
function placeIssues(editor, html, elements, issues) {
  const doc = parseCheckDocument(html);
  const keys = elementKeys(editor);
  const placed = [];
  for (const issue of issues) {
    const where = locateIssue(doc, issue);
    if (where.kind === 'wrapper') continue;
    const live = where.kind === 'content' ? elements[where.ref] : null;
    placed.push({ issue, key: live ? nearestKey(keys, live) : null });
  }
  return placed;
}

/** Outline the content each placed finding belongs to. */
function markPlaced(editor, placed) {
  for (const { key } of placed) {
    const element = key ? editor.getElementByKey(key) : null;
    if (element) element.setAttribute(ISSUE_ATTRIBUTE, 'true');
  }
}

/** The language to declare on the check document. */
function contentLanguage(root, fallback) {
  const owner = root.closest('[lang]');
  return (owner && owner.getAttribute('lang')) || fallback || 'en';
}

/** The status sentence for the live region. */
function statusMessage(t, state, count) {
  switch (state) {
    case 'running':
      return t('a11yCheckRunning');
    case 'done':
      return count === 0 ? t('a11yCheckNone') : t('a11yCheckFound', { count });
    case 'stale':
      return t('a11yCheckStale');
    case 'error':
      return t('a11yCheckFailed');
    default:
      return t('a11yCheckIdle');
  }
}

function IssueItem({ entry, index, idPrefix, onShow, t }) {
  const { issue, key } = entry;
  const titleId = `${idPrefix}-title-${index}`;
  const meta = [
    issue.severity ? t('a11ySeverity', { severity: issue.severity }) : null,
    issue.wcag && issue.wcag.length > 0 ? t('a11yWcag', { criteria: issue.wcag.join(', ') }) : null,
    issue.needsReview ? t('a11yNeedsReview') : null,
  ].filter(Boolean);

  return (
    <li className="editor-a11y-check-item">
      <div className="editor-a11y-check-item-title" id={titleId}>
        {issue.title}
      </div>
      {meta.length > 0 ? <p className="editor-a11y-check-meta">{meta.join(' · ')}</p> : null}
      {issue.description ? <p className="editor-a11y-check-detail">{issue.description}</p> : null}
      {issue.remediation ? (
        // Engine guidance can run to a long paragraph: a native disclosure keeps
        // the list scannable and is keyboard- and screen-reader-operable as is.
        <details className="editor-a11y-check-fix">
          <summary>{t('a11yHowToFix')}</summary>
          <p className="editor-a11y-check-detail">{issue.remediation}</p>
        </details>
      ) : null}
      <div className="editor-a11y-check-actions">
        {key ? (
          <button
            type="button"
            className="editor-a11y-check-show"
            aria-describedby={titleId}
            onClick={() => onShow(entry)}
          >
            {t('a11yShowIssue')}
          </button>
        ) : (
          <p className="editor-a11y-check-detail">{t('a11yNotPlaced')}</p>
        )}
        {issue.helpUrl ? (
          <a
            className="editor-a11y-check-help"
            href={issue.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('a11yLearnMore')}
          </a>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The Accessibility check panel. Rendered by `Editor` when the host passes an
 * `accessibilityChecker`.
 * @param {object} props component props.
 * @param {(request: { html: string }) => Promise<object[]>} props.checker checks
 *   a complete HTML document and resolves to its issues.
 */
export function AccessibilityCheckPlugin({ checker }) {
  const [editor] = useLexicalComposerContext();
  const { t, i18n } = useTranslation();
  const [idPrefix] = useState(() => {
    instanceCount += 1;
    return `lexic-a11y-check-${instanceCount}`;
  });
  const [state, setState] = useState('idle');
  const [results, setResults] = useState([]);
  const [notice, setNotice] = useState('');
  const runRef = useRef(0);
  const versionRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Any content edit invalidates the results. Selection-only updates (moving
  // the caret, including our own "Show in content") leave nodes clean.
  useEffect(
    () =>
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        versionRef.current += 1;
        if (stateRef.current === 'done') {
          clearMarks(editor.getRootElement());
          setNotice('');
          setState('stale');
        }
      }),
    [editor],
  );

  // Clear marks if the plugin goes away (e.g. the host drops the checker).
  useEffect(() => () => clearMarks(editor.getRootElement()), [editor]);

  const runCheck = useCallback(async () => {
    const root = editor.getRootElement();
    if (!root || stateRef.current === 'running') return;

    runRef.current += 1;
    const run = runRef.current;
    const version = versionRef.current;
    clearMarks(root);
    setNotice('');
    setState('running');

    const { html, elements } = buildCheckDocument(root, {
      lang: contentLanguage(root, i18n.language),
      title: t('editorContent'),
    });

    // Only the checker's own failure (network, server, engine) is reported as
    // a failed check; a fault in placing the results is a bug and is left to
    // surface as one rather than being disguised as "try again".
    let issues;
    try {
      issues = await checker({ html });
    } catch {
      if (run !== runRef.current) return;
      setResults([]);
      setState('error');
      return;
    }
    if (run !== runRef.current) return;

    const placed = placeIssues(editor, html, elements, Array.isArray(issues) ? issues : []);
    setResults(placed);
    if (version !== versionRef.current) {
      // The author kept typing while the check ran: show what was found, but
      // do not mark content that may have moved.
      setState('stale');
      return;
    }
    markPlaced(editor, placed);
    setState('done');
  }, [checker, editor, i18n.language, t]);

  const showIssue = useCallback(
    ({ key }) => {
      const element = editor.getElementByKey(key);
      if (!element) {
        setNotice(t('a11yIssueGone'));
        return;
      }
      setNotice('');
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (!node) return;
        if ($isDecoratorNode(node)) {
          const selection = $createNodeSelection();
          selection.add(key);
          $setSelection(selection);
        } else {
          node.selectStart();
        }
      });
      editor.focus();
      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center' });
      }
      const root = editor.getRootElement();
      if (root && stateRef.current === 'done') {
        for (const marked of root.querySelectorAll(`[${ISSUE_ATTRIBUTE}="active"]`)) {
          marked.setAttribute(ISSUE_ATTRIBUTE, 'true');
        }
        element.setAttribute(ISSUE_ATTRIBUTE, 'active');
      }
    },
    [editor, t],
  );

  const running = state === 'running';
  const showList = results.length > 0 && (state === 'done' || state === 'stale');

  return (
    <section className="editor-a11y-check">
      {/* Like the outline panel: part of one form control, so it adds neither
          a heading nor a landmark to the host page (see issue #88). */}
      <div className="editor-a11y-check-header">
        <div className="editor-a11y-check-title">{t('a11yCheckTitle')}</div>
        <button
          type="button"
          className="editor-a11y-check-run"
          onClick={runCheck}
          // aria-disabled rather than disabled: the button keeps focus while
          // the check runs, instead of dropping it to <body>.
          aria-disabled={running ? 'true' : undefined}
        >
          {/* A constant label: the status region below announces progress, so
              renaming the focused button as well would be read twice. */}
          {t('a11yCheckRun')}
        </button>
      </div>

      <div role="status" aria-live="polite" className="editor-a11y-check-status">
        <p>{statusMessage(t, state, results.length)}</p>
        {notice ? <p>{notice}</p> : null}
      </div>

      {showList ? (
        <ol className="editor-a11y-check-list" aria-label={t('a11yIssuesList')}>
          {results.map((entry, index) => (
            <IssueItem
              // Index first: ids come from the host's checker and are not
              // guaranteed unique.
              key={`${index}-${entry.issue.id}`}
              entry={entry}
              index={index}
              idPrefix={idPrefix}
              onShow={showIssue}
              t={t}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
