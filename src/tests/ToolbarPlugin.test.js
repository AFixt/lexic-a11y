import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { $isLinkNode } from '@lexical/link';
import { $createQuoteNode, $isQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { $createParagraphNode } from 'lexical';
import { I18nextProvider } from 'react-i18next';

import { ToolbarPlugin } from '../components/ToolbarPlugin';
import i18n from '../utils/i18n';

// Mock Lexical API
const mockEditor = {
  update: jest.fn((callback) => callback()),
  dispatchCommand: jest.fn(),
  registerCommand: jest.fn(() => () => {}),
  registerUpdateListener: jest.fn(() => () => {}),
  focus: jest.fn(),
  getEditorState: jest.fn().mockReturnValue({
    read: jest.fn((cb) => cb()),
  }),
};

// Mock Lexical hooks
jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

// Mock Lexical commands
const mockAnchorNode = {
  getParent: jest.fn(() => null),
  getURL: jest.fn(() => 'https://example.com'),
  getTextContent: jest.fn(() => 'Example link'),
};

// Mock text nodes returned by selection.getNodes() for clear-formatting tests
const mockTextNodes = [
  { setFormat: jest.fn(), setStyle: jest.fn() },
  { setFormat: jest.fn(), setStyle: jest.fn() },
];

const mockSelection = {
  isRange: true,
  isCollapsed: jest.fn(() => false),
  getTextContent: jest.fn(() => 'selected text'),
  getNodes: jest.fn(() => mockTextNodes),
  insertText: jest.fn(),
  insertNodes: jest.fn(),
  modify: jest.fn(),
  hasFormat: jest.fn(() => false),
  anchor: {
    getNode: jest.fn(() => mockAnchorNode),
  },
  focus: {
    getNode: jest.fn(() => mockAnchorNode),
  },
};

jest.mock('lexical', () => {
  class ElementNode {}
  class TextNode {}
  return {
    $getSelection: jest.fn(() => mockSelection),
    $insertNodes: jest.fn(),
    $createRangeSelection: jest.fn(() => ({
      anchor: { set: jest.fn() },
      focus: { set: jest.fn() },
    })),
    $setSelection: jest.fn(),
    $isRangeSelection: jest.fn(() => true),
    $isTextNode: jest.fn(() => true),
    $createParagraphNode: jest.fn(() => ({})),
    KEY_ESCAPE_COMMAND: 'escape',
    COMMAND_PRIORITY_CRITICAL: 4,
    COMMAND_PRIORITY_HIGH: 1,
    COMMAND_PRIORITY_LOW: 0,
    FORMAT_TEXT_COMMAND: 'format-text',
    UNDO_COMMAND: 'undo',
    REDO_COMMAND: 'redo',
    CAN_UNDO_COMMAND: 'can-undo',
    CAN_REDO_COMMAND: 'can-redo',
    ElementNode,
    TextNode,
  };
});

jest.mock('@lexical/list', () => ({
  INSERT_ORDERED_LIST_COMMAND: 'insert-ordered-list',
  INSERT_UNORDERED_LIST_COMMAND: 'insert-unordered-list',
  REMOVE_LIST_COMMAND: 'remove-list',
  $isListNode: jest.fn(() => false),
  $isListItemNode: jest.fn(() => false),
}));

jest.mock('@lexical/selection', () => ({
  $setBlocksType: jest.fn(),
}));

jest.mock('@lexical/rich-text', () => ({
  $createHeadingNode: jest.fn(() => ({})),
  $isHeadingNode: jest.fn(() => false),
  $createQuoteNode: jest.fn(() => ({})),
  $isQuoteNode: jest.fn(() => false),
}));

jest.mock('@lexical/link', () => ({
  TOGGLE_LINK_COMMAND: 'toggle-link',
  $isLinkNode: jest.fn(() => false),
}));

jest.mock('@lexical/code', () => ({
  $createCodeNode: jest.fn(() => ({})),
  $isCodeNode: jest.fn(() => false),
}));

jest.mock('@lexical/table', () => ({
  INSERT_TABLE_COMMAND: 'insert-table',
}));

jest.mock('../components/ImageNode', () => ({
  $createImageNode: jest.fn((options) => ({ __image: true, ...options })),
}));

jest.mock('@lexical/react/LexicalHorizontalRuleNode', () => ({
  INSERT_HORIZONTAL_RULE_COMMAND: 'insert-horizontal-rule',
}));

// Helper for rendering with i18n provider
const renderWithI18n = (component) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

describe('ToolbarPlugin Component', () => {
  let setShowDocs;

  beforeEach(() => {
    setShowDocs = jest.fn();
    mockEditor.dispatchCommand.mockClear();
    mockEditor.update.mockClear();
    mockEditor.registerCommand.mockClear();
    mockEditor.registerUpdateListener.mockClear();
  });

  it('renders the toolbar with formatting buttons', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Underline')).toBeInTheDocument();
    expect(screen.getByLabelText('Strikethrough')).toBeInTheDocument();

    // Heading buttons
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`H${i}`)).toBeInTheDocument();
    }

    // Link button
    expect(screen.getByLabelText('Insert Link')).toBeInTheDocument();
  });

  it('dispatches bold command when bold button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const boldButton = screen.getByLabelText('Bold');
    await user.click(boldButton);

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'bold');
  });

  it('dispatches italic command when italic button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const italicButton = screen.getByLabelText('Italic');
    await user.click(italicButton);

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'italic');
  });

  it('dispatches underline command when underline button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const underlineButton = screen.getByLabelText('Underline');
    await user.click(underlineButton);

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'underline');
  });

  it('dispatches strikethrough command when strikethrough button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const strikethroughButton = screen.getByLabelText('Strikethrough');
    await user.click(strikethroughButton);

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'strikethrough');
  });

  it('applies heading formatting when H1 button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const h1Button = screen.getByLabelText('H1');
    await user.click(h1Button);

    expect(mockEditor.update).toHaveBeenCalled();
  });

  it('renders the clear formatting button', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const clearButton = screen.getByLabelText('Clear Formatting');
    expect(clearButton).toBeInTheDocument();
    // Action button, not a toggle — must not expose aria-pressed
    expect(clearButton).not.toHaveAttribute('aria-pressed');
  });

  it('clears inline formats and resets blocks when clear formatting is clicked', async () => {
    const user = userEvent.setup();
    const { $setBlocksType } = require('@lexical/selection');
    const { $createParagraphNode } = require('lexical');
    $setBlocksType.mockClear();
    $createParagraphNode.mockClear();
    mockTextNodes.forEach((node) => {
      node.setFormat.mockClear();
      node.setStyle.mockClear();
    });

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
    await user.click(screen.getByLabelText('Clear Formatting'));

    expect(mockEditor.update).toHaveBeenCalled();

    // Inline marks and styles cleared on every selected text node
    mockTextNodes.forEach((node) => {
      expect(node.setFormat).toHaveBeenCalledWith(0);
      expect(node.setStyle).toHaveBeenCalledWith('');
    });

    // Blocks reset to paragraphs
    expect($setBlocksType).toHaveBeenCalled();
    const creator = $setBlocksType.mock.calls[$setBlocksType.mock.calls.length - 1][1];
    creator();
    expect($createParagraphNode).toHaveBeenCalled();

    // No list present here, so the list-removal command is not dispatched
    expect(mockEditor.dispatchCommand).not.toHaveBeenCalledWith('remove-list', undefined);
  });

  it('removes list formatting when clearing a list selection', async () => {
    const user = userEvent.setup();
    const { $isListItemNode } = require('@lexical/list');
    $isListItemNode.mockReturnValue(true);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
    await user.click(screen.getByLabelText('Clear Formatting'));

    // List blocks are unwrapped via REMOVE_LIST_COMMAND ($setBlocksType can't)
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('remove-list', undefined);

    $isListItemNode.mockReturnValue(false);
  });

  it('renders inline code and code block buttons with aria-pressed state', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const inlineCodeButton = screen.getByLabelText('Inline Code');
    const codeBlockButton = screen.getByLabelText('Code Block');

    expect(inlineCodeButton).toBeInTheDocument();
    expect(codeBlockButton).toBeInTheDocument();
    expect(inlineCodeButton).toHaveAttribute('aria-pressed', 'false');
    expect(codeBlockButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('dispatches the code text format when inline code button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Inline Code'));

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'code');
  });

  it('applies a code block via $setBlocksType when not already in one', async () => {
    const user = userEvent.setup();
    $setBlocksType.mockClear();
    $createCodeNode.mockClear();
    $isCodeNode.mockReturnValue(false);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
    await user.click(screen.getByLabelText('Code Block'));

    expect($setBlocksType).toHaveBeenCalled();
    // The block creator passed to $setBlocksType must produce a code node
    const creator = $setBlocksType.mock.calls[$setBlocksType.mock.calls.length - 1][1];
    creator();
    expect($createCodeNode).toHaveBeenCalled();
  });

  it('converts back to a paragraph when the selection is already a code block', async () => {
    const user = userEvent.setup();
    $setBlocksType.mockClear();
    $createParagraphNode.mockClear();
    $isCodeNode.mockReturnValue(true);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
    await user.click(screen.getByLabelText('Code Block'));

    expect($setBlocksType).toHaveBeenCalled();
    const creator = $setBlocksType.mock.calls[$setBlocksType.mock.calls.length - 1][1];
    creator();
    expect($createParagraphNode).toHaveBeenCalled();

    $isCodeNode.mockReturnValue(false);
  });

  it('reflects inline code active state from the selection format', () => {
    mockSelection.hasFormat.mockImplementation((format) => format === 'code');

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(screen.getByLabelText('Inline Code')).toHaveAttribute('aria-pressed', 'true');

    mockSelection.hasFormat.mockImplementation(() => false);
  });

  it('reflects active formats at a collapsed caret (cursor inside formatted text)', () => {
    // A collapsed caret with no selected text must still light up the matching
    // toggle, so the cursor's formatting context is always visible.
    mockSelection.isCollapsed.mockReturnValue(true);
    mockSelection.getTextContent.mockReturnValueOnce('');
    mockSelection.hasFormat.mockImplementation((format) => format === 'bold');

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(screen.getByLabelText('Bold')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Italic')).toHaveAttribute('aria-pressed', 'false');

    mockSelection.hasFormat.mockImplementation(() => false);
    mockSelection.isCollapsed.mockReturnValue(false);
  });

  describe('image insertion with required alt text', () => {
    const openImageDialog = async (user) => {
      await user.click(screen.getByLabelText('Insert Image'));
    };

    it('opens the image dialog from the toolbar button', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);

      expect(screen.getByRole('dialog', { name: 'Insert Image' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Alt Text/)).toBeInTheDocument();
      expect(screen.getByLabelText(/decorative/i)).toBeInTheDocument();
    });

    it('disables Insert until alt text is provided', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);
      await user.type(screen.getByLabelText(/URL/), 'https://example.com/cat.png');

      const insertButton = screen.getByRole('button', { name: 'Insert' });
      expect(insertButton).toBeDisabled();

      await user.type(screen.getByLabelText(/Alt Text/), 'A cat');
      expect(insertButton).toBeEnabled();
    });

    it('keeps Insert disabled for a whitespace-only URL or alt text', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);
      const insertButton = screen.getByRole('button', { name: 'Insert' });

      // Whitespace-only URL must not enable Insert
      await user.type(screen.getByLabelText(/URL/), '   ');
      await user.type(screen.getByLabelText(/Alt Text/), 'A cat');
      expect(insertButton).toBeDisabled();

      // Real URL but whitespace-only alt (not decorative) also stays disabled
      await user.clear(screen.getByLabelText(/URL/));
      await user.type(screen.getByLabelText(/URL/), 'https://example.com/cat.png');
      await user.clear(screen.getByLabelText(/Alt Text/));
      await user.type(screen.getByLabelText(/Alt Text/), '   ');
      expect(insertButton).toBeDisabled();
    });

    it('allows insertion without alt text only when explicitly marked decorative', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);
      await user.type(screen.getByLabelText(/URL/), 'https://example.com/border.png');

      const insertButton = screen.getByRole('button', { name: 'Insert' });
      expect(insertButton).toBeDisabled();

      await user.click(screen.getByLabelText(/decorative/i));
      expect(insertButton).toBeEnabled();
      // Alt input is disabled in decorative mode
      expect(screen.getByLabelText(/Alt Text/)).toBeDisabled();
    });

    it('inserts a meaningful image node with the provided alt text', async () => {
      const user = userEvent.setup();
      const { $createImageNode } = require('../components/ImageNode');
      const { $insertNodes } = require('lexical');
      $createImageNode.mockClear();
      $insertNodes.mockClear();

      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);
      await user.type(screen.getByLabelText(/URL/), 'https://example.com/cat.png');
      await user.type(screen.getByLabelText(/Alt Text/), 'A cat');
      await user.click(screen.getByRole('button', { name: 'Insert' }));

      expect($createImageNode).toHaveBeenCalledWith({
        src: 'https://example.com/cat.png',
        alt: 'A cat',
        decorative: false,
      });
      expect($insertNodes).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('inserts a decorative image with empty alt', async () => {
      const user = userEvent.setup();
      const { $createImageNode } = require('../components/ImageNode');
      $createImageNode.mockClear();

      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);
      await user.type(screen.getByLabelText(/URL/), 'https://example.com/border.png');
      await user.click(screen.getByLabelText(/decorative/i));
      await user.click(screen.getByRole('button', { name: 'Insert' }));

      expect($createImageNode).toHaveBeenCalledWith({
        src: 'https://example.com/border.png',
        alt: '',
        decorative: true,
      });
    });

    it('cancels without inserting', async () => {
      const user = userEvent.setup();
      const { $insertNodes } = require('lexical');
      $insertNodes.mockClear();

      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await openImageDialog(user);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect($insertNodes).not.toHaveBeenCalled();
    });
  });

  describe('image upload (when an upload handler is configured)', () => {
    const pngFile = () => new File(['x'], 'cat.png', { type: 'image/png' });
    const openImageDialog = (user) => user.click(screen.getByLabelText('Insert Image'));

    it('does not render the drop zone when no upload handler is provided', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      await openImageDialog(user);

      expect(screen.queryByRole('button', { name: 'Choose image file' })).not.toBeInTheDocument();
    });

    it('renders a drop zone and file picker when a handler is provided', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} onImageUpload={jest.fn()} />,
      );
      await openImageDialog(user);

      expect(screen.getByRole('button', { name: 'Choose image file' })).toBeInTheDocument();
    });

    it('uploads a selected file and fills the URL from the handler result', async () => {
      const onImageUpload = jest.fn().mockResolvedValue('https://cdn.test/cat.png');
      const user = userEvent.setup();
      const { container } = renderWithI18n(
        <ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} onImageUpload={onImageUpload} />,
      );
      await openImageDialog(user);

      const fileInput = container.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [pngFile()] } });

      await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(1));
      expect(onImageUpload.mock.calls[0][0]).toBeInstanceOf(File);
      await waitFor(() =>
        expect(screen.getByLabelText(/paste an image URL/i)).toHaveValue(
          'https://cdn.test/cat.png',
        ),
      );
    });

    it('rejects a non-image file and does not call the handler', async () => {
      const onImageUpload = jest.fn();
      const user = userEvent.setup();
      const { container } = renderWithI18n(
        <ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} onImageUpload={onImageUpload} />,
      );
      await openImageDialog(user);

      const fileInput = container.querySelector('input[type="file"]');
      fireEvent.change(fileInput, {
        target: { files: [new File(['x'], 'note.txt', { type: 'text/plain' })] },
      });

      expect(onImageUpload).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(/not an image/i);
    });

    it('surfaces an error when the upload handler rejects', async () => {
      const onImageUpload = jest.fn().mockRejectedValue(new Error('network'));
      const user = userEvent.setup();
      const { container } = renderWithI18n(
        <ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} onImageUpload={onImageUpload} />,
      );
      await openImageDialog(user);

      const fileInput = container.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [pngFile()] } });

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Upload failed/i));
    });
  });

  describe('table insertion', () => {
    it('opens the table dialog with accessible defaults', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await user.click(screen.getByLabelText('Insert Table'));

      expect(screen.getByRole('dialog', { name: 'Insert Table' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Rows/)).toHaveValue(3);
      expect(screen.getByLabelText(/Columns/)).toHaveValue(3);
      // Header row on by default for accessible tables
      expect(screen.getByLabelText(/Include header row/)).toBeChecked();
    });

    it('dispatches INSERT_TABLE_COMMAND with rows, columns, and headers', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await user.click(screen.getByLabelText('Insert Table'));
      await user.click(screen.getByRole('button', { name: 'Insert' }));

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('insert-table', {
        rows: '3',
        columns: '3',
        includeHeaders: { rows: true, columns: false },
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('respects custom dimensions and header choice', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await user.click(screen.getByLabelText('Insert Table'));
      const rowsInput = screen.getByLabelText(/Rows/);
      const columnsInput = screen.getByLabelText(/Columns/);
      await user.clear(rowsInput);
      await user.type(rowsInput, '2');
      await user.clear(columnsInput);
      await user.type(columnsInput, '5');
      await user.click(screen.getByLabelText(/Include header row/));
      await user.click(screen.getByRole('button', { name: 'Insert' }));

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('insert-table', {
        rows: '2',
        columns: '5',
        includeHeaders: { rows: false, columns: false },
      });
    });

    it('disables Insert for invalid dimensions', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await user.click(screen.getByLabelText('Insert Table'));
      await user.clear(screen.getByLabelText(/Rows/));

      expect(screen.getByRole('button', { name: 'Insert' })).toBeDisabled();
    });

    it('cancels without inserting', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      await user.click(screen.getByLabelText('Insert Table'));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockEditor.dispatchCommand).not.toHaveBeenCalledWith(
        'insert-table',
        expect.anything(),
      );
    });
  });

  describe('roving tabindex (WAI-ARIA toolbar pattern)', () => {
    const getToolbarButtons = () => {
      const toolbar = screen.getByRole('toolbar');
      return Array.from(toolbar.querySelectorAll('.toolbar-group > button'));
    };

    it('exposes exactly one tab stop', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      const buttons = getToolbarButtons();
      const tabStops = buttons.filter((button) => button.tabIndex === 0);
      const skipped = buttons.filter((button) => button.tabIndex === -1);

      expect(buttons.length).toBeGreaterThan(1);
      expect(tabStops).toHaveLength(1);
      expect(skipped).toHaveLength(buttons.length - 1);
    });

    it('declares a horizontal orientation', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('skips a disabled button when moving focus', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      const buttons = getToolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      // Disable the second control; roving should step over it.
      buttons[1].disabled = true;
      buttons[0].focus();
      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });

      expect(buttons[2]).toHaveFocus();
      expect(buttons[1]).not.toHaveFocus();
    });

    it('moves focus with ArrowRight and updates the tab stop', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      const buttons = getToolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      buttons[0].focus();
      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });

      expect(buttons[1]).toHaveFocus();
      expect(buttons[1].tabIndex).toBe(0);
      expect(buttons[0].tabIndex).toBe(-1);
    });

    it('moves focus with ArrowLeft and wraps from the first to the last control', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      const buttons = getToolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      buttons[0].focus();
      fireEvent.keyDown(toolbar, { key: 'ArrowLeft' });

      expect(buttons[buttons.length - 1]).toHaveFocus();
    });

    it('wraps from the last control to the first with ArrowRight', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      const buttons = getToolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      buttons[buttons.length - 1].focus();
      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });

      expect(buttons[0]).toHaveFocus();
    });

    it('jumps to first/last with Home and End', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      const buttons = getToolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      buttons[2].focus();
      fireEvent.keyDown(toolbar, { key: 'End' });
      expect(buttons[buttons.length - 1]).toHaveFocus();

      fireEvent.keyDown(toolbar, { key: 'Home' });
      expect(buttons[0]).toHaveFocus();
    });

    it('updates the roving tab stop when a button gains focus directly', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
      const buttons = getToolbarButtons();

      fireEvent.focus(buttons[3]);

      expect(buttons[3].tabIndex).toBe(0);
      expect(buttons[0].tabIndex).toBe(-1);
    });

    it('preserves aria-pressed semantics on toolbar toggles', () => {
      renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

      expect(screen.getByLabelText('Bold')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByLabelText('Bold')).toHaveAttribute('aria-label', 'Bold');
    });
  });

  // Helper to find a command handler registered with the mock editor
  const getRegisteredHandler = (command) => {
    const call = mockEditor.registerCommand.mock.calls.find(([cmd]) => cmd === command);
    return call ? call[1] : null;
  };

  it('renders undo and redo buttons disabled by default', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const undoButton = screen.getByLabelText('Undo');
    const redoButton = screen.getByLabelText('Redo');

    expect(undoButton).toBeInTheDocument();
    expect(redoButton).toBeInTheDocument();
    // aria-disabled (not native disabled) so the controls stay in the tab order
    // and are announced as disabled rather than disappearing for AT users.
    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeEnabled();
    expect(undoButton).toHaveAttribute('aria-disabled', 'true');
    expect(redoButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not dispatch undo while unavailable but stays focusable', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const undoButton = screen.getByLabelText('Undo');
    undoButton.focus();
    expect(undoButton).toHaveFocus();

    await user.click(undoButton);
    expect(mockEditor.dispatchCommand).not.toHaveBeenCalledWith('undo', undefined);
  });

  it('registers listeners for undo/redo availability', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(getRegisteredHandler('can-undo')).toEqual(expect.any(Function));
    expect(getRegisteredHandler('can-redo')).toEqual(expect.any(Function));
  });

  it('enables the undo button when undo becomes available and dispatches UNDO_COMMAND', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    // Simulate the editor reporting undo availability
    act(() => {
      getRegisteredHandler('can-undo')(true);
    });

    const undoButton = screen.getByLabelText('Undo');
    expect(undoButton).toBeEnabled();
    expect(undoButton).toHaveAttribute('aria-disabled', 'false');

    await user.click(undoButton);
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('undo', undefined);
  });

  it('enables the redo button when redo becomes available and dispatches REDO_COMMAND', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    // Simulate the editor reporting redo availability
    act(() => {
      getRegisteredHandler('can-redo')(true);
    });

    const redoButton = screen.getByLabelText('Redo');
    expect(redoButton).toBeEnabled();
    expect(redoButton).toHaveAttribute('aria-disabled', 'false');

    await user.click(redoButton);
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('redo', undefined);
  });

  it('disables the undo button again when undo becomes unavailable', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    act(() => {
      getRegisteredHandler('can-undo')(true);
    });
    expect(screen.getByLabelText('Undo')).toBeEnabled();

    act(() => {
      getRegisteredHandler('can-undo')(false);
    });
    expect(screen.getByLabelText('Undo')).toHaveAttribute('aria-disabled', 'true');
  });
  it('renders the blockquote button with aria-pressed state', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const quoteButton = screen.getByLabelText('Blockquote');
    expect(quoteButton).toBeInTheDocument();
    expect(quoteButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles blockquote formatting when blockquote button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const quoteButton = screen.getByLabelText('Blockquote');
    await user.click(quoteButton);

    expect(mockEditor.update).toHaveBeenCalled();
  });

  it('applies a quote block when the selection is not already a quote', async () => {
    const user = userEvent.setup();
    $setBlocksType.mockClear();
    $createQuoteNode.mockClear();
    $isQuoteNode.mockReturnValue(false);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
    await user.click(screen.getByLabelText('Blockquote'));

    expect($setBlocksType).toHaveBeenCalled();
    // The block creator passed to $setBlocksType must produce a quote node
    const creator = $setBlocksType.mock.calls[$setBlocksType.mock.calls.length - 1][1];
    creator();
    expect($createQuoteNode).toHaveBeenCalled();
  });

  it('converts back to a paragraph when the selection is already a quote', async () => {
    const user = userEvent.setup();
    $setBlocksType.mockClear();
    $createParagraphNode.mockClear();
    $isQuoteNode.mockReturnValue(true);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);
    await user.click(screen.getByLabelText('Blockquote'));

    expect($setBlocksType).toHaveBeenCalled();
    // The block creator passed to $setBlocksType must produce a paragraph node
    const creator = $setBlocksType.mock.calls[$setBlocksType.mock.calls.length - 1][1];
    creator();
    expect($createParagraphNode).toHaveBeenCalled();

    $isQuoteNode.mockReturnValue(false);
  });

  it('toggles blockquote with the Ctrl+Shift+Q keyboard shortcut', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'Q', ctrlKey: true, shiftKey: true });

    expect(mockEditor.update).toHaveBeenCalled();
  });

  it('toggles strikethrough with the Ctrl+Shift+X keyboard shortcut', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'X', ctrlKey: true, shiftKey: true });

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'strikethrough');
  });

  it('toggles inline code with the Ctrl+E keyboard shortcut', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'e', ctrlKey: true });

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'code');
  });

  it('toggles a code block with the Ctrl+Shift+E keyboard shortcut', () => {
    mockEditor.update.mockClear();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'E', ctrlKey: true, shiftKey: true });

    expect(mockEditor.update).toHaveBeenCalled();
  });

  it('clears formatting with the Ctrl+\\ keyboard shortcut', () => {
    mockEditor.update.mockClear();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: '\\', ctrlKey: true });

    expect(mockEditor.update).toHaveBeenCalled();
  });

  it('inserts a horizontal rule with the Ctrl+Shift+- keyboard shortcut', () => {
    mockEditor.dispatchCommand.mockClear();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: '_', ctrlKey: true, shiftKey: true });

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('insert-horizontal-rule', undefined);
  });

  it('opens the image dialog with the Ctrl+Shift+M keyboard shortcut', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'M', ctrlKey: true, shiftKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens the table dialog with the Ctrl+Shift+L keyboard shortcut', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'L', ctrlKey: true, shiftKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the horizontal rule button', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(screen.getByLabelText('Insert Horizontal Rule')).toBeInTheDocument();
  });

  it('dispatches INSERT_HORIZONTAL_RULE_COMMAND when the horizontal rule button is clicked', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Insert Horizontal Rule'));

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('insert-horizontal-rule', undefined);
  });

  it('registers escape key command handler', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(mockEditor.registerCommand).toHaveBeenCalledWith(
      'escape',
      expect.any(Function),
      1, // COMMAND_PRIORITY_HIGH
    );
  });

  it('registers update listener on mount', () => {
    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    expect(mockEditor.registerUpdateListener).toHaveBeenCalled();
  });

  it('initializes the link dialog when link button is clicked', async () => {
    const user = userEvent.setup();

    mockSelection.getTextContent.mockReturnValueOnce('test link text');

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const linkButton = screen.getByLabelText('Insert Link');
    await user.click(linkButton);

    // Verify editor state was read to get selection
    expect(mockEditor.getEditorState().read).toHaveBeenCalled();
  });

  it('opens the accessible link dialog with Ctrl+K instead of window.prompt', () => {
    const promptSpy = jest.fn();
    window.prompt = promptSpy;

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).toBeInTheDocument();
  });

  it('reflects cursor-in-link state on the link button via aria-pressed', () => {
    $isLinkNode.mockReturnValue(true);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    const linkButton = screen.getByLabelText('Edit Link');
    expect(linkButton).toHaveAttribute('aria-pressed', 'true');

    $isLinkNode.mockReturnValue(false);
  });

  it('pre-fills the dialog with the existing link URL and text in edit mode', async () => {
    const user = userEvent.setup();
    $isLinkNode.mockReturnValue(true);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Edit Link'));

    expect(screen.getByRole('heading', { name: 'Edit Link' })).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).toHaveValue('https://example.com');
    expect(screen.getByLabelText(/Text/)).toHaveValue('Example link');

    $isLinkNode.mockReturnValue(false);
  });

  it('removes an existing link via the Remove Link button', async () => {
    const user = userEvent.setup();
    $isLinkNode.mockReturnValue(true);

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Edit Link'));
    await user.click(screen.getByRole('button', { name: 'Remove Link' }));

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('toggle-link', null);
    // Dialog closes and focus returns to the editor
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockEditor.focus).toHaveBeenCalled();

    $isLinkNode.mockReturnValue(false);
  });

  it('does not show Remove Link when inserting a new link', async () => {
    const user = userEvent.setup();

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Insert Link'));

    expect(screen.getByRole('heading', { name: 'Insert Link' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Link' })).not.toBeInTheDocument();
  });

  it('returns focus to the editor when the dialog is cancelled', async () => {
    const user = userEvent.setup();

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Insert Link'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockEditor.focus).toHaveBeenCalled();
  });

  it('rejects a javascript: URL: disables Insert, shows an error, dispatches nothing', async () => {
    const user = userEvent.setup();

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Insert Link'));
    await user.type(screen.getByLabelText(/URL/), 'javascript:alert(1)');

    const insertButton = screen.getByRole('button', { name: 'Insert' });
    expect(insertButton).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).toHaveAttribute('aria-invalid', 'true');

    // Even if the click somehow fires, no link command is dispatched.
    await user.click(insertButton);
    expect(mockEditor.dispatchCommand).not.toHaveBeenCalledWith('toggle-link', expect.anything());
  });

  it('enables Insert for a safe https URL', async () => {
    const user = userEvent.setup();

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    await user.click(screen.getByLabelText('Insert Link'));
    await user.type(screen.getByLabelText(/URL/), 'https://example.com');

    expect(screen.getByRole('button', { name: 'Insert' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('edits an existing link in place without duplicating its text', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    // Cursor is inside a link: $isLinkNode true => edit mode, and findLinkNode
    // returns the anchor node, which must behave like a LinkNode.
    $isLinkNode.mockReturnValue(true);
    mockAnchorNode.select = jest.fn();
    mockAnchorNode.getChildrenSize = jest.fn(() => 1);
    mockSelection.insertText.mockClear();
    mockEditor.dispatchCommand.mockClear();

    renderWithI18n(<ToolbarPlugin showDocs={false} setShowDocs={setShowDocs} />);

    // Edit mode prefills the URL (https://example.com); submit it.
    await user.click(screen.getByLabelText('Edit Link'));
    await user.click(screen.getByRole('button', { name: 'Insert' }));

    // The update runs on a 50ms timeout after the dialog closes.
    act(() => {
      jest.advanceTimersByTime(60);
    });

    // The existing link's contents are selected and its URL updated in place;
    // the link text is NOT re-inserted (the bug this guards against).
    expect(mockAnchorNode.select).toHaveBeenCalled();
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('toggle-link', {
      url: 'https://example.com',
      target: '_blank',
    });
    expect(mockSelection.insertText).not.toHaveBeenCalled();

    $isLinkNode.mockReturnValue(false);
    jest.useRealTimers();
  });
});

describe('ToolbarPlugin allowedFormats', () => {
  // The text, lists and links profile a short-form field (e.g. a booking
  // description) restricts the editor to.
  const TEXT_LISTS_LINKS = [
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'bulletList',
    'numberedList',
    'link',
  ];
  const TEXT_LISTS_LINKS_LABELS = [
    'Undo',
    'Redo',
    'Bold',
    'Italic',
    'Underline',
    'Strikethrough',
    'Clear Formatting',
    'Insert Link',
    'Bullet List',
    'Numbered List',
    'Show Help',
  ];

  const toolbarButtons = () =>
    Array.from(screen.getByRole('toolbar').querySelectorAll('.toolbar-group > button'));
  const toolbarLabels = () => toolbarButtons().map((button) => button.getAttribute('aria-label'));

  const renderToolbar = (allowedFormats) =>
    renderWithI18n(
      <ToolbarPlugin showDocs={false} setShowDocs={jest.fn()} allowedFormats={allowedFormats} />,
    );

  // The handler the toolbar registers to veto disallowed inline formats
  const formatTextVeto = () => {
    const call = mockEditor.registerCommand.mock.calls.find(
      ([command, , priority]) => command === 'format-text' && priority === 4,
    );
    return call ? call[1] : null;
  };

  beforeEach(() => {
    mockEditor.dispatchCommand.mockClear();
    mockEditor.update.mockClear();
    mockEditor.registerCommand.mockClear();
  });

  it('renders every control when the prop is omitted', () => {
    renderToolbar(undefined);

    expect(toolbarLabels()).toEqual([
      'Undo',
      'Redo',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Inline Code',
      'Code Block',
      'Clear Formatting',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'Blockquote',
      'Insert Link',
      'Insert Image',
      'Insert Table',
      'Bullet List',
      'Numbered List',
      'Insert Horizontal Rule',
      'Show Help',
    ]);
  });

  it('vetoes no inline format when the prop is omitted', () => {
    renderToolbar(undefined);

    const veto = formatTextVeto();
    ['bold', 'italic', 'underline', 'strikethrough', 'code'].forEach((format) => {
      expect(veto(format)).toBe(false);
    });
  });

  it('renders only text, list and link controls for that allowlist', () => {
    renderToolbar(TEXT_LISTS_LINKS);

    expect(toolbarLabels()).toEqual(TEXT_LISTS_LINKS_LABELS);
    expect(screen.queryByLabelText('Insert Image')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Insert Table')).not.toBeInTheDocument();
    for (let level = 1; level <= 6; level++) {
      expect(screen.queryByLabelText(`H${level}`)).not.toBeInTheDocument();
    }
  });

  it('leaves no empty toolbar groups behind', () => {
    renderToolbar(TEXT_LISTS_LINKS);

    const groups = screen.getByRole('toolbar').querySelectorAll('.toolbar-group');
    groups.forEach((group) => {
      expect(group.querySelectorAll('button').length).toBeGreaterThan(0);
    });
  });

  it('ignores Ctrl+Shift+M and Ctrl+Shift+L when images and tables are not allowed', () => {
    renderToolbar(TEXT_LISTS_LINKS);

    fireEvent.keyDown(document, { key: 'M', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 'L', ctrlKey: true, shiftKey: true });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores block, heading, code and rule shortcuts that are not allowed', () => {
    renderToolbar(TEXT_LISTS_LINKS);

    fireEvent.keyDown(document, { key: '1', ctrlKey: true, altKey: true });
    fireEvent.keyDown(document, { key: 'Q', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 'E', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 'e', ctrlKey: true });
    fireEvent.keyDown(document, { key: '_', ctrlKey: true, shiftKey: true });

    expect(mockEditor.update).not.toHaveBeenCalled();
    expect(mockEditor.dispatchCommand).not.toHaveBeenCalled();
  });

  it('does not preventDefault a shortcut it ignores', () => {
    renderToolbar(TEXT_LISTS_LINKS);

    const event = createEvent.keyDown(document, { key: 'M', ctrlKey: true, shiftKey: true });
    fireEvent(document, event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps the shortcuts of allowed formats working', () => {
    renderToolbar(TEXT_LISTS_LINKS);

    fireEvent.keyDown(document, { key: '8', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 'X', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('insert-unordered-list', undefined);
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith('format-text', 'strikethrough');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('vetoes disallowed inline formats at FORMAT_TEXT_COMMAND (native Ctrl+B/I/U)', () => {
    renderToolbar(['italic', 'link']);

    const veto = formatTextVeto();
    expect(veto('bold')).toBe(true);
    expect(veto('underline')).toBe(true);
    expect(veto('code')).toBe(true);
    expect(veto('italic')).toBe(false);
  });

  it('offers only the allowed heading levels and their shortcuts', () => {
    renderToolbar(['h2', 'h3']);

    expect(screen.queryByLabelText('H1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('H2')).toBeInTheDocument();
    expect(screen.getByLabelText('H3')).toBeInTheDocument();
    expect(screen.queryByLabelText('H4')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: '1', ctrlKey: true, altKey: true });
    expect(mockEditor.update).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: '2', ctrlKey: true, altKey: true });
    expect(mockEditor.update).toHaveBeenCalled();
  });

  it('keeps only undo, redo, clear formatting and help for an empty allowlist', () => {
    renderToolbar([]);

    expect(toolbarLabels()).toEqual(['Undo', 'Redo', 'Clear Formatting', 'Show Help']);
  });

  it('ignores format names it does not know', () => {
    renderToolbar(['bold', 'sparkles']);

    expect(toolbarLabels()).toEqual(['Undo', 'Redo', 'Bold', 'Clear Formatting', 'Show Help']);
  });

  describe('roving tabindex across the reduced toolbar', () => {
    it('exposes exactly one tab stop', () => {
      renderToolbar(TEXT_LISTS_LINKS);

      const tabStops = toolbarButtons().filter((button) => button.tabIndex === 0);
      expect(tabStops).toHaveLength(1);
      expect(toolbarButtons().filter((button) => button.tabIndex === -1)).toHaveLength(10);
    });

    it('visits every remaining control with ArrowRight, in order, then wraps', () => {
      renderToolbar(TEXT_LISTS_LINKS);
      const buttons = toolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      buttons[0].focus();
      const visited = [document.activeElement.getAttribute('aria-label')];
      for (let step = 1; step < buttons.length; step++) {
        fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
        visited.push(document.activeElement.getAttribute('aria-label'));
      }
      expect(visited).toEqual(TEXT_LISTS_LINKS_LABELS);

      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
      expect(buttons[0]).toHaveFocus();
    });

    it('moves the tab stop with focus and jumps to the ends with Home and End', () => {
      renderToolbar(TEXT_LISTS_LINKS);
      const buttons = toolbarButtons();
      const toolbar = screen.getByRole('toolbar');

      buttons[0].focus();
      fireEvent.keyDown(toolbar, { key: 'End' });
      expect(screen.getByLabelText('Show Help')).toHaveFocus();
      expect(screen.getByLabelText('Show Help').tabIndex).toBe(0);
      expect(buttons[0].tabIndex).toBe(-1);

      fireEvent.keyDown(toolbar, { key: 'ArrowLeft' });
      expect(screen.getByLabelText('Numbered List')).toHaveFocus();

      fireEvent.keyDown(toolbar, { key: 'Home' });
      expect(screen.getByLabelText('Undo')).toHaveFocus();
    });
  });
});
