// Automated accessibility assertions (@afixt/a11y-assert) on rendered UI.
// Each render is checked against the library's WCAG rule set; violations fail
// the suite with details.
import { runAccessibilityTests } from '@afixt/a11y-assert';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import Editor from '../components/Editor';
import { ToolbarPlugin } from '../components/ToolbarPlugin';
import i18n from '../utils/i18n';

// --- Lexical mocks (same pattern as the other suites) ---
const mockEditor = {
  update: jest.fn((callback) => callback()),
  dispatchCommand: jest.fn(),
  registerCommand: jest.fn(() => () => {}),
  registerUpdateListener: jest.fn(() => () => {}),
  focus: jest.fn(),
  getEditorState: jest.fn().mockReturnValue({ read: jest.fn((cb) => cb()) }),
};

jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

jest.mock('lexical', () => ({
  $getSelection: jest.fn(() => null),
  $isRangeSelection: jest.fn(() => false),
  $createParagraphNode: jest.fn(() => ({})),
  $getRoot: jest.fn(() => ({ getChildren: () => [], getTextContent: () => '' })),
  KEY_ESCAPE_COMMAND: 'escape',
  COMMAND_PRIORITY_HIGH: 1,
  FORMAT_TEXT_COMMAND: 'format-text',
}));

jest.mock('@lexical/list', () => ({
  INSERT_ORDERED_LIST_COMMAND: 'insert-ordered-list',
  INSERT_UNORDERED_LIST_COMMAND: 'insert-unordered-list',
  REMOVE_LIST_COMMAND: 'remove-list',
  $isListNode: jest.fn(() => false),
  $isListItemNode: jest.fn(() => false),
  ListNode: class ListNode {},
  ListItemNode: class ListItemNode {},
}));

jest.mock('@lexical/selection', () => ({ $setBlocksType: jest.fn() }));

jest.mock('@lexical/rich-text', () => ({
  $createHeadingNode: jest.fn(() => ({})),
  $isHeadingNode: jest.fn(() => false),
  HeadingNode: class HeadingNode {},
  QuoteNode: class QuoteNode {},
}));

jest.mock('@lexical/link', () => ({
  TOGGLE_LINK_COMMAND: 'toggle-link',
  LinkNode: class LinkNode {},
}));

jest.mock('@lexical/code', () => ({
  CodeNode: class CodeNode {},
  CodeHighlightNode: class CodeHighlightNode {},
  $createCodeNode: jest.fn(() => ({})),
  $isCodeNode: jest.fn(() => false),
}));

jest.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }) => <div>{children}</div>,
}));
jest.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: ({ contentEditable }) => <div>{contentEditable}</div>,
}));
jest.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: () => (
    <div role="textbox" aria-label="Editor content" aria-multiline="true" tabIndex={0} />
  ),
}));
jest.mock('@lexical/react/LexicalHistoryPlugin', () => ({ HistoryPlugin: () => null }));
jest.mock('@lexical/react/LexicalOnChangePlugin', () => ({ OnChangePlugin: () => null }));
jest.mock('@lexical/react/LexicalErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));
jest.mock('@lexical/react/LexicalLinkPlugin', () => ({ LinkPlugin: () => null }));
jest.mock('@lexical/react/LexicalListPlugin', () => ({ ListPlugin: () => null }));
jest.mock('@lexical/react/LexicalMarkdownShortcutPlugin', () => ({
  MarkdownShortcutPlugin: () => null,
}));
jest.mock('../components/PastePlugin', () => ({ PastePlugin: () => null }));
jest.mock('../components/ImageNode', () => ({
  ImageNode: class ImageNode {},
  $createImageNode: jest.fn(() => ({})),
}));
jest.mock('@lexical/table', () => ({
  TableNode: class TableNode {},
  TableRowNode: class TableRowNode {},
  TableCellNode: class TableCellNode {},
  INSERT_TABLE_COMMAND: 'insert-table',
}));
jest.mock('@lexical/react/LexicalTablePlugin', () => ({ TablePlugin: () => null }));
jest.mock('@lexical/react/LexicalHorizontalRuleNode', () => ({
  HorizontalRuleNode: class HorizontalRuleNode {},
  INSERT_HORIZONTAL_RULE_COMMAND: 'insert-horizontal-rule',
}));
jest.mock('@lexical/react/LexicalHorizontalRulePlugin', () => ({
  HorizontalRulePlugin: () => null,
}));
jest.mock('../utils/markdown-transformers', () => ({ EDITOR_TRANSFORMERS: [] }));
jest.mock('@lexical/html', () => ({ $generateHtmlFromNodes: () => '' }));

const renderWithI18n = (component) =>
  render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);

// jsdom documents have no <main>/landmark structure; wrap renders so the
// assertions exercise the components inside a realistic page skeleton
const withPageChrome = (component) => (
  <main>
    <h1>Editor test page</h1>
    {component}
  </main>
);

// Rules that cannot produce meaningful results under jsdom and are therefore
// excluded here (they ARE covered by the real-browser axe scan in e2e/):
// - KEYBOARD-01: focus indication is judged from computed CSS; jsdom loads no
//   stylesheets, so every element looks unstyled
// - NAVIGATION-08: site-level rule (search facility/sitemap) — not applicable
//   to an embeddable component under test
const JSDOM_INAPPLICABLE_RULES = new Set(['KEYBOARD-01', 'NAVIGATION-08']);

const expectAccessible = async (element) => {
  const results = await runAccessibilityTests(element, [], { returnResults: true });
  const applicable = results.filter((violation) => !JSDOM_INAPPLICABLE_RULES.has(violation.ruleId));
  expect(applicable).toEqual([]);
};

describe('accessibility assertions (a11y-assert)', () => {
  it('toolbar renders without accessibility violations', async () => {
    renderWithI18n(withPageChrome(<ToolbarPlugin showDocs={false} setShowDocs={jest.fn()} />));

    await expectAccessible(document.body);
  });

  it('toolbar with the link dialog open has no violations', async () => {
    const user = userEvent.setup();
    renderWithI18n(withPageChrome(<ToolbarPlugin showDocs={false} setShowDocs={jest.fn()} />));

    await user.click(screen.getByLabelText('Insert Link'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await expectAccessible(document.body);
  });

  it('editor (with shortcuts overlay closed) has no violations', async () => {
    renderWithI18n(withPageChrome(<Editor onContentChange={jest.fn()} />));

    await expectAccessible(document.body);
  });

  // showOutline is off by default, so the case above no longer covers the
  // outline panel. Assert it explicitly — the panel sits inside the host's
  // page structure, which is exactly where its markup has to behave (#88).
  it('editor with the outline panel shown has no violations', async () => {
    renderWithI18n(withPageChrome(<Editor onContentChange={jest.fn()} showOutline />));

    expect(screen.getByRole('region', { name: 'Document Outline' })).toBeInTheDocument();
    // The panel must not add to the host page's heading outline: the only
    // heading here is the page's own h1 from withPageChrome.
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Editor test page');

    await expectAccessible(document.body);
  });
});
