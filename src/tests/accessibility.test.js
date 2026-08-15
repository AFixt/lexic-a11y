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

// Root children the mocked editor state exposes. Defaults to empty; a test can
// populate it to exercise the outline in its non-empty state, where it renders
// the heading list rather than the empty-state message.
let mockRootChildren = [];

const makeHeadingNode = (key, tag, text) => ({
  __isHeading: true,
  getKey: () => key,
  getTag: () => tag,
  getTextContent: () => text,
  selectStart: jest.fn(),
});

jest.mock('lexical', () => ({
  $getSelection: jest.fn(() => null),
  $isRangeSelection: jest.fn(() => false),
  $createParagraphNode: jest.fn(() => ({})),
  $getRoot: jest.fn(() => ({ getChildren: () => mockRootChildren, getTextContent: () => '' })),
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
  $isHeadingNode: jest.fn((node) => Boolean(node && node.__isHeading)),
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

// The build gate runs only the engine's `automatic` rules — the machine-
// decidable checks. @afixt/afixt-engine classifies every rule by `type`:
// `automatic` results are confirmed violations, while `auto_assisted`, `manual`
// and `ai_assisted` results are *candidates for human verification* (the rules
// say so in their own `manualVerification` text), not confirmed failures. An
// advisory candidate that a person still has to judge must not hard-fail CI, so
// we ask the runner to load only automatic rules (engineOptions.type).
//
// This is a root-cause fix, not a per-rule allowlist: any advisory rule — now
// or added upstream later — is excluded by construction. The case that
// prompted it (#101) is TIMEOUTS-04 (WCAG 2.2.4 Interruptions, Level AAA),
// which from @afixt/afixt-tests 1.35.x flags the polite word-count live region
// (`role="status" aria-live="polite"`) as an auto_assisted candidate — a
// correct candidate but not a violation: a status the user causes by typing is
// the opposite of an unrequested interruption. Filtering by type keeps a
// genuine A/AA regression failing (a dropped accessible name still trips the
// automatic FORMS rules) while advisory candidates no longer gate the build.
//
// This narrows what THIS suite hard-gates. Two Level-A checks that are
// classified auto_assisted — NON-TEXT-CONTENT-01 (missing alt) and FORMS-08
// (missing visible label) — used to gate here and no longer do; that trade-off
// is the issue's chosen option (#101). Those specific behaviours stay covered by
// the component/unit tests (ImageNode.test.js asserts alt/decorative handling,
// ToolbarPlugin.test.js the toolbar controls), and text-contrast /
// focus-indication — unevaluable under jsdom, which loads no stylesheets — by
// the real-browser Playwright checks in e2e/editor.spec.js. (This repo bans
// axe-core, so those are Playwright assertions, not an axe scan — see CLAUDE.md.)
// The use-case suite (usecases/) documents these interactions but is
// validation-only in CI, so it is not a substitute gate.
//
// The guard test at the end of this file pins the point of all this: the
// automatic-only gate must still FAIL on a genuine A/AA violation, not quietly
// pass everything.
const expectAccessible = async (element) => {
  const results = await runAccessibilityTests(element, [], {
    returnResults: true,
    engineOptions: { type: 'automatic' },
  });
  expect(results).toEqual([]);
};

describe('accessibility assertions (a11y-assert)', () => {
  beforeEach(() => {
    mockRootChildren = [];
  });

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
    // Populate the outline: with no headings it renders its empty-state message
    // instead of the list, so the assertions below would pass vacuously.
    mockRootChildren = [
      makeHeadingNode('1', 'h1', 'Seeded title'),
      makeHeadingNode('2', 'h2', 'Seeded section'),
    ];

    renderWithI18n(withPageChrome(<Editor onContentChange={jest.fn()} showOutline />));

    expect(screen.getByRole('list', { name: 'Document Outline' })).toBeInTheDocument();
    // The panel must not add to the host page's heading outline: the only
    // heading here is the page's own h1 from withPageChrome.
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Editor test page');
    // Nor to its landmark structure: the only landmark is the page's own <main>.
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(screen.queryAllByRole('navigation')).toHaveLength(0);

    await expectAccessible(document.body);
  });

  // Guard test — the discriminating half of the gate. The four cases above only
  // prove the gate PASSES clean UI; none prove it still FAILS a real violation.
  // Without this, a change that made the filter drop every rule (a typo in the
  // engineOptions, an upstream reclassification of the FORMS rules) would leave
  // the suite green and the gate silently inert. An unlabeled control trips the
  // automatic FORMS rules (FORMS-09/FORMS-28, WCAG Level A), so this must find at
  // least one violation.
  it('still fails on a genuine A/AA violation (an unlabeled control)', async () => {
    renderWithI18n(withPageChrome(<input type="text" />));

    const results = await runAccessibilityTests(document.body, [], {
      returnResults: true,
      engineOptions: { type: 'automatic' },
    });

    expect(results.length).toBeGreaterThan(0);
  });
});
