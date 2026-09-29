// Integration tests for the Accessibility check panel (issue #155), on a real
// Lexical editor: seeding, the document the checker receives, placing findings
// back on nodes, "Show in content", and invalidation on edit.
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { $createHeadingNode, HeadingNode } from '@lexical/rich-text';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import { I18nextProvider } from 'react-i18next';

import { AccessibilityCheckPlugin } from '../components/AccessibilityCheckPlugin';
import i18n from '../utils/i18n';

const HEADING_XPATH = '/html[1]/body[1]/main[1]/h4[1]';

let editorRef;

function CaptureEditor() {
  const [editor] = useLexicalComposerContext();
  editorRef = editor;
  return null;
}

function renderPanel(checker) {
  const config = {
    namespace: 'a11y-check-test',
    nodes: [HeadingNode],
    onError(error) {
      throw error;
    },
  };
  const utils = render(
    <I18nextProvider i18n={i18n}>
      <LexicalComposer initialConfig={config}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" ariaLabel="Editor content" />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <CaptureEditor />
        <AccessibilityCheckPlugin checker={checker} />
      </LexicalComposer>
    </I18nextProvider>,
  );
  act(() => {
    editorRef.update(
      () => {
        const root = $getRoot();
        root.clear();
        const h1 = $createHeadingNode('h1');
        h1.append($createTextNode('Report'));
        const h4 = $createHeadingNode('h4');
        h4.append($createTextNode('Skipped a level'));
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Body text.'));
        root.append(h1, h4, paragraph);
      },
      { discrete: true },
    );
  });
  return utils;
}

const issue = (overrides = {}) => ({
  id: 'issue-1',
  ruleId: 'STRUCTURE-08',
  title: 'Headings are in incorrect hierarchical order',
  description: 'Heading level skips from H1 to H4',
  remediation: 'Do not skip heading levels.',
  severity: 'Low',
  wcag: ['1.3.1 Info and Relationships'],
  needsReview: false,
  xpath: HEADING_XPATH,
  helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
  ...overrides,
});

const statusText = () => screen.getByRole('status').textContent;
const runCheck = () => userEvent.click(screen.getByRole('button', { name: 'Check accessibility' }));

beforeAll(() => {
  // jsdom does not implement scrolling.
  Element.prototype.scrollIntoView = jest.fn();
});

describe('AccessibilityCheckPlugin', () => {
  it('starts idle, with a named button and a polite status', () => {
    renderPanel(jest.fn());
    expect(screen.getByRole('button', { name: 'Check accessibility' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(statusText()).toMatch(/Check the content for accessibility issues/);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('sends the content as a complete document with a ref on every element', async () => {
    const checker = jest.fn().mockResolvedValue([]);
    renderPanel(checker);

    await runCheck();

    expect(checker).toHaveBeenCalledTimes(1);
    const { html } = checker.mock.calls[0][0];
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.documentElement.getAttribute('lang')).toBe('en');
    expect(doc.querySelector('main > h1').textContent).toBe('Report');
    expect(doc.querySelector('main > h4').hasAttribute('data-lexic-a11y-ref')).toBe(true);
    // Editing plumbing is not part of the content under test.
    expect(doc.querySelector('[contenteditable]')).toBeNull();
    expect(html).not.toMatch(/data-lexical/);
  });

  it('shows the running state without dropping focus, then the findings', async () => {
    let resolve;
    const checker = jest.fn(
      () =>
        new Promise((_resolve) => {
          resolve = _resolve;
        }),
    );
    renderPanel(checker);
    const button = screen.getByRole('button', { name: 'Check accessibility' });

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    expect(statusText()).toMatch(/Checking accessibility/);

    // A second activation while running is ignored.
    await userEvent.click(button);
    expect(checker).toHaveBeenCalledTimes(1);

    await act(async () => resolve([issue()]));

    expect(button).not.toHaveAttribute('aria-disabled');
    expect(statusText()).toMatch(/^1 accessibility issue found\./);
    const list = screen.getByRole('list', { name: 'Accessibility issues' });
    const item = within(list).getByRole('listitem');
    expect(item).toHaveTextContent('Headings are in incorrect hierarchical order');
    expect(item).toHaveTextContent('Low severity · WCAG 1.3.1 Info and Relationships');
    expect(item).toHaveTextContent('How to fix');
    expect(within(item).getByRole('link', { name: /Learn more/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('outlines the affected content and nothing else', async () => {
    const { container } = renderPanel(jest.fn().mockResolvedValue([issue()]));
    await runCheck();

    expect(container.querySelector('h4')).toHaveAttribute('data-lexic-a11y-issue', 'true');
    expect(container.querySelector('h1')).not.toHaveAttribute('data-lexic-a11y-issue');
    expect(container.querySelectorAll('[data-lexic-a11y-issue]')).toHaveLength(1);
  });

  it('places a finding on a nested element on its nearest node', async () => {
    const { container } = renderPanel(
      jest.fn().mockResolvedValue([issue({ xpath: `${HEADING_XPATH}/span[1]` })]),
    );
    await runCheck();

    expect(container.querySelector('h4 span')).toHaveAttribute('data-lexic-a11y-issue', 'true');
    expect(screen.getByRole('button', { name: 'Show in content' })).toBeInTheDocument();
  });

  it('falls back to the selector when there is no usable XPath', async () => {
    const { container } = renderPanel(
      jest.fn().mockResolvedValue([issue({ xpath: '!!not xpath', selector: 'main > h4' })]),
    );
    await runCheck();

    expect(container.querySelector('h4')).toHaveAttribute('data-lexic-a11y-issue', 'true');
  });

  it('moves the caret to the finding and emphasises it', async () => {
    const { container } = renderPanel(jest.fn().mockResolvedValue([issue()]));
    await runCheck();

    const show = screen.getByRole('button', { name: 'Show in content' });
    // The repeated button text is tied to its own issue.
    expect(show).toHaveAccessibleDescription('Headings are in incorrect hierarchical order');
    await userEvent.click(show);

    const heading = container.querySelector('h4');
    expect(heading).toHaveAttribute('data-lexic-a11y-issue', 'active');
    expect(heading.scrollIntoView).toHaveBeenCalled();
    let anchorText;
    editorRef.getEditorState().read(() => {
      const selection = $getSelection();
      anchorText = $isRangeSelection(selection)
        ? selection.anchor.getNode().getTopLevelElementOrThrow().getTextContent()
        : null;
    });
    expect(anchorText).toBe('Skipped a level');
  });

  it('drops findings on the wrapper the editor adds around the content', async () => {
    renderPanel(
      jest
        .fn()
        .mockResolvedValue([
          issue({ id: 'title', xpath: '/html[1]/head[1]/title[1]' }),
          issue({ id: 'main', xpath: '/html[1]/body[1]/main[1]' }),
        ]),
    );
    await runCheck();

    expect(statusText()).toMatch(/No accessibility issues found/);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists a finding it cannot place, without a Show button', async () => {
    renderPanel(
      jest.fn().mockResolvedValue([issue({ xpath: '/html[1]/body[1]/main[1]/table[1]' })]),
    );
    await runCheck();

    expect(statusText()).toMatch(/^1 accessibility issue found\./);
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'could not be matched to a specific part of the content',
    );
    expect(screen.queryByRole('button', { name: 'Show in content' })).not.toBeInTheDocument();
  });

  it('reports a failed check and keeps nothing marked', async () => {
    const { container } = renderPanel(jest.fn().mockRejectedValue(new Error('HTTP 500')));
    await runCheck();

    expect(statusText()).toMatch(/could not be completed/);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-lexic-a11y-issue]')).toHaveLength(0);
  });

  it('flags results as out of date and clears the marks when the content changes', async () => {
    const { container } = renderPanel(jest.fn().mockResolvedValue([issue()]));
    await runCheck();
    expect(container.querySelectorAll('[data-lexic-a11y-issue]')).toHaveLength(1);

    act(() => {
      editorRef.update(
        () => {
          $getRoot().getLastChild().append($createTextNode(' More.'));
        },
        { discrete: true },
      );
    });

    await waitFor(() => expect(statusText()).toMatch(/content has changed since the last check/));
    expect(container.querySelectorAll('[data-lexic-a11y-issue]')).toHaveLength(0);
    // The findings stay readable, and can still be navigated to.
    expect(screen.getByRole('list', { name: 'Accessibility issues' })).toBeInTheDocument();
  });

  it('does not mark content that changed while the check was running', async () => {
    let resolve;
    const { container } = renderPanel(
      () =>
        new Promise((_resolve) => {
          resolve = _resolve;
        }),
    );
    await runCheck();
    act(() => {
      editorRef.update(() => $getRoot().getLastChild().append($createTextNode('!')), {
        discrete: true,
      });
    });
    await act(async () => resolve([issue()]));

    expect(statusText()).toMatch(/content has changed since the last check/);
    expect(container.querySelectorAll('[data-lexic-a11y-issue]')).toHaveLength(0);
  });

  it('tells the author when the content an issue pointed at is gone', async () => {
    renderPanel(jest.fn().mockResolvedValue([issue()]));
    await runCheck();

    act(() => {
      editorRef.update(() => $getRoot().getChildAtIndex(1).remove(), { discrete: true });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Show in content' }));

    expect(statusText()).toMatch(/no longer in the document/);
  });
});
