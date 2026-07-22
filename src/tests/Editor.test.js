import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import Editor from '../components/Editor';
import i18n from '../utils/i18n';

// Mock Lexical node types used in editorConfig
jest.mock('@lexical/rich-text', () => ({
  HeadingNode: class HeadingNode {},
  QuoteNode: class QuoteNode {},
}));

jest.mock('@lexical/table', () => ({
  TableNode: class TableNode {},
  TableRowNode: class TableRowNode {},
  TableCellNode: class TableCellNode {},
}));

jest.mock('@lexical/react/LexicalTablePlugin', () => ({
  TablePlugin: () => <div data-testid="table-plugin" />,
}));

jest.mock('@lexical/code', () => ({
  CodeNode: class CodeNode {},
  CodeHighlightNode: class CodeHighlightNode {},
}));

jest.mock('@lexical/list', () => ({
  ListNode: class ListNode {},
  ListItemNode: class ListItemNode {},
}));

jest.mock('@lexical/link', () => ({
  LinkNode: class LinkNode {},
}));

// Mock the Lexical components and plugins
jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: jest.fn(() => [
    { update: jest.fn(), getEditorState: () => ({ read: (cb) => cb() }) },
  ]),
}));

jest.mock('@lexical/markdown', () => ({
  $convertToMarkdownString: jest.fn(() => '# Markdown output'),
}));

jest.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }) => <div data-testid="lexical-composer">{children}</div>,
}));

jest.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: ({ contentEditable, placeholder }) => (
    <div data-testid="rich-text-plugin">
      {contentEditable}
      {placeholder}
    </div>
  ),
}));

jest.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: () => <div data-testid="content-editable" />,
}));

jest.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: () => <div data-testid="history-plugin" />,
}));

jest.mock('@lexical/react/LexicalHorizontalRuleNode', () => ({
  HorizontalRuleNode: class HorizontalRuleNode {},
  INSERT_HORIZONTAL_RULE_COMMAND: 'insert-horizontal-rule',
}));

jest.mock('@lexical/react/LexicalHorizontalRulePlugin', () => ({
  HorizontalRulePlugin: () => <div data-testid="horizontal-rule-plugin" />,
}));

jest.mock('@lexical/react/LexicalMarkdownShortcutPlugin', () => ({
  MarkdownShortcutPlugin: () => <div data-testid="markdown-shortcut-plugin" />,
}));

// Capture the OnChangePlugin onChange prop so tests can exercise the export path
const mockOnChangeCapture = {};

jest.mock('@lexical/react/LexicalOnChangePlugin', () => ({
  OnChangePlugin: ({ onChange }) => {
    mockOnChangeCapture.onChange = onChange;
    return <div data-testid="on-change-plugin" />;
  },
}));

jest.mock('@lexical/react/LexicalErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('@lexical/react/LexicalLinkPlugin', () => ({
  LinkPlugin: () => <div data-testid="link-plugin" />,
}));

jest.mock('@lexical/react/LexicalListPlugin', () => ({
  ListPlugin: () => <div data-testid="list-plugin" />,
}));

jest.mock('@lexical/html', () => ({
  $generateHtmlFromNodes: jest.fn(() => '<p>Test HTML Output</p>'),
}));

jest.mock('../components/HeadingOutlinePlugin', () => ({
  HeadingOutlinePlugin: () => <div data-testid="heading-outline-plugin" />,
}));

jest.mock('../components/WordCountPlugin', () => ({
  WordCountPlugin: () => <div data-testid="word-count-plugin" />,
}));

// Stub the curated transformers so the real @lexical/markdown (which pulls in
// the mocked lexical packages above) is never loaded in this suite
jest.mock('../utils/markdown-transformers', () => ({
  EDITOR_TRANSFORMERS: [],
}));

jest.mock('../components/PastePlugin', () => ({
  PastePlugin: () => <div data-testid="paste-plugin" />,
}));

// Capture the html prop passed to the initial-content plugin so tests can
// assert the editor seeds from `initialValue`.
const mockInitialContentCapture = {};

jest.mock('../components/InitialContentPlugin', () => ({
  InitialContentPlugin: ({ html }) => {
    mockInitialContentCapture.html = html;
    return <div data-testid="initial-content-plugin" />;
  },
}));

jest.mock('../components/ImageNode', () => ({
  ImageNode: class ImageNode {},
}));

// Mock ToolbarPlugin to expose setShowDocs trigger
jest.mock('../components/ToolbarPlugin', () => ({
  ToolbarPlugin: ({ setShowDocs }) => (
    <div data-testid="toolbar-plugin">
      <button data-testid="show-docs-button" onClick={() => setShowDocs(true)}>
        Show Docs
      </button>
    </div>
  ),
}));

const renderWithI18n = (component) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

describe('Editor Component', () => {
  it('renders without crashing', () => {
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    expect(screen.getByTestId('lexical-composer')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('content-editable')).toBeInTheDocument();
  });

  it('renders the editor plugins', () => {
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    expect(screen.getByTestId('history-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('horizontal-rule-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('link-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('list-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-shortcut-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('on-change-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('paste-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('heading-outline-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('word-count-plugin')).toBeInTheDocument();
    expect(screen.getByTestId('table-plugin')).toBeInTheDocument();
  });

  it('renders the outline panel by default', () => {
    renderWithI18n(<Editor onContentChange={jest.fn()} />);

    expect(screen.getByTestId('heading-outline-plugin')).toBeInTheDocument();
  });

  it('omits the outline panel when showOutline is false', () => {
    renderWithI18n(<Editor onContentChange={jest.fn()} showOutline={false} />);

    expect(screen.queryByTestId('heading-outline-plugin')).not.toBeInTheDocument();
    // The rest of the editor is unaffected
    expect(screen.getByTestId('content-editable')).toBeInTheDocument();
    expect(screen.getByTestId('word-count-plugin')).toBeInTheDocument();
  });

  it('does not render the initial-content plugin when initialValue is omitted', () => {
    mockInitialContentCapture.html = undefined;
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    expect(screen.queryByTestId('initial-content-plugin')).not.toBeInTheDocument();
  });

  it('seeds the editor from initialValue when provided', () => {
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} initialValue="<p>Seed me</p>" />);

    expect(screen.getByTestId('initial-content-plugin')).toBeInTheDocument();
    expect(mockInitialContentCapture.html).toBe('<p>Seed me</p>');
  });

  it('exports a clean semantic <hr> through the HTML cleanup path', () => {
    const { $generateHtmlFromNodes } = require('@lexical/html');
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    // Simulate Lexical emitting an hr with theme classes/attributes
    $generateHtmlFromNodes.mockReturnValueOnce(
      '<p>Intro</p><hr class="my-4" data-x="1"><p>End</p>',
    );
    mockOnChangeCapture.onChange({ read: (cb) => cb() }, {});

    expect(mockOnContentChange).toHaveBeenCalledWith('<p>Intro</p><hr><p>End</p>');
  });

  it('emits Markdown when outputFormat is "markdown"', () => {
    const { $convertToMarkdownString } = require('@lexical/markdown');
    const { $generateHtmlFromNodes } = require('@lexical/html');
    $convertToMarkdownString.mockClear();
    $generateHtmlFromNodes.mockClear();
    const mockOnContentChange = jest.fn();

    renderWithI18n(<Editor onContentChange={mockOnContentChange} outputFormat="markdown" />);

    // Both the on-edit path and the format-change sync use the Markdown serializer
    mockOnChangeCapture.onChange({ read: (cb) => cb() }, {});

    expect($convertToMarkdownString).toHaveBeenCalled();
    expect($generateHtmlFromNodes).not.toHaveBeenCalled();
    expect(mockOnContentChange).toHaveBeenCalledWith('# Markdown output');
  });

  it('emits HTML by default (outputFormat omitted)', () => {
    const { $convertToMarkdownString } = require('@lexical/markdown');
    $convertToMarkdownString.mockClear();
    const mockOnContentChange = jest.fn();

    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);
    mockOnChangeCapture.onChange({ read: (cb) => cb() }, {});

    expect($convertToMarkdownString).not.toHaveBeenCalled();
    // Default HTML mock output, cleaned of classes
    expect(mockOnContentChange).toHaveBeenCalledWith('<p>Test HTML Output</p>');
  });

  it('exports clean, semantic table HTML with scoped header cells', () => {
    const { $generateHtmlFromNodes } = require('@lexical/html');
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    // Simulate Lexical's real export: a <colgroup> for sizing and a header row
    // of <th> cells with inline styles/classes.
    $generateHtmlFromNodes.mockReturnValueOnce(
      '<table class="min-w-full"><colgroup><col style="width:92px"><col></colgroup><tbody class="x"><tr class="y"><th style="width:75px" class="z">Name</th><th>Role</th></tr><tr><td style="width:75px">Ada</td><td>Engineer</td></tr></tbody></table>',
    );
    mockOnChangeCapture.onChange({ read: (cb) => cb() }, {});

    const exported = mockOnContentChange.mock.calls[0][0];
    // <colgroup>/<col> sizing markup is dropped.
    expect(exported).not.toMatch(/colgroup|<col\b/);
    // Header-row cells are scoped as column headers; no stray scope="row".
    expect(exported).toBe(
      '<table><tbody><tr><th scope="col">Name</th><th scope="col">Role</th></tr><tr><td>Ada</td><td>Engineer</td></tr></tbody></table>',
    );
    expect(exported).not.toContain('scope="row"');
  });

  it('handles <thead> and styled cells with attributes before style', () => {
    const { $generateHtmlFromNodes } = require('@lexical/html');
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    // A <thead> must NOT be corrupted into <th scope="col"ead>, and a cell whose
    // style attribute comes after colspan must still have its style stripped.
    $generateHtmlFromNodes.mockReturnValueOnce(
      '<table class="t"><thead><tr><th colspan="2" style="width:75px" class="z">Name</th></tr></thead><tbody><tr><td>Ada</td><td>Engineer</td></tr></tbody></table>',
    );
    mockOnChangeCapture.onChange({ read: (cb) => cb() }, {});

    const exported = mockOnContentChange.mock.calls[0][0];
    expect(exported).toContain('<thead>');
    expect(exported).not.toMatch(/scope="col"ead/);
    expect(exported).not.toContain('style=');
    // colspan is preserved and scope is added to the header cell.
    expect(exported).toContain('<th scope="col" colspan="2">');
  });

  it('does not show docs overlay by default', () => {
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    expect(screen.queryByLabelText('Editor documentation')).not.toBeInTheDocument();
  });

  it('shows docs overlay when triggered via toolbar', async () => {
    const user = userEvent.setup();
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    const showDocsButton = screen.getByTestId('show-docs-button');
    await user.click(showDocsButton);

    expect(screen.getByLabelText('Editor documentation')).toBeInTheDocument();
    expect(screen.getByText('Editor Shortcuts')).toBeInTheDocument();
  });

  it('displays editor documentation content in docs overlay', async () => {
    const user = userEvent.setup();
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    const showDocsButton = screen.getByTestId('show-docs-button');
    await user.click(showDocsButton);

    expect(screen.getByText('Markdown auto-formatting')).toBeInTheDocument();
    expect(screen.getByText('Strikethrough')).toBeInTheDocument();
    expect(screen.getByText('Insert table')).toBeInTheDocument();
    expect(screen.getByText('Toggle this help dialog')).toBeInTheDocument();
  });

  it('exports semantic <pre>/<code> without utility classes', () => {
    const { $generateHtmlFromNodes } = require('@lexical/html');
    const mockOnContentChange = jest.fn();
    renderWithI18n(<Editor onContentChange={mockOnContentChange} />);

    $generateHtmlFromNodes.mockReturnValueOnce(
      '<pre class="editor-code-block"><code class="editor-text-code">const x = 1;</code></pre>' +
        '<p>uses <code class="editor-text-code">inline</code> code</p>',
    );
    mockOnChangeCapture.onChange({ read: (cb) => cb() }, {});

    expect(mockOnContentChange).toHaveBeenCalledWith(
      '<pre><code>const x = 1;</code></pre><p>uses <code>inline</code> code</p>',
    );
  });
});
