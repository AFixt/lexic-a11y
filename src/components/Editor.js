// Editor.js
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { $generateHtmlFromNodes } from '@lexical/html';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { $convertToMarkdownString } from '@lexical/markdown';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EDITOR_TRANSFORMERS } from '../utils/markdown-transformers';
import { isSafeUrl } from '../utils/sanitize-url';

import { HeadingOutlinePlugin } from './HeadingOutlinePlugin';
import { ImageNode } from './ImageNode';
import { InitialContentPlugin } from './InitialContentPlugin';
import { PastePlugin } from './PastePlugin';
import { ToolbarPlugin } from './ToolbarPlugin';
import { WordCountPlugin } from './WordCountPlugin';
// Temporarily comment out missing imports

const theme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
    code: 'editor-text-code',
  },
  code: 'editor-code-block',
  heading: {
    h1: 'text-3xl font-bold mt-6 mb-4',
    h2: 'text-2xl font-bold mt-5 mb-3',
    h3: 'text-xl font-bold mt-4 mb-2',
    h4: 'text-lg font-bold mt-3 mb-2',
    h5: 'text-base font-bold mt-2 mb-1',
    h6: 'text-sm font-bold mt-2 mb-1',
  },
  list: {
    ul: 'list-disc ml-5 my-2',
    ol: 'list-decimal ml-5 my-2',
    li: 'my-1',
  },
  link: 'text-blue-600 underline',
  table: 'min-w-full border-collapse border border-gray-300 my-4',
  tableRow: 'border-t border-gray-300',
  tableCell: 'border border-gray-300 p-2',
  tableHeader: 'bg-gray-100 font-bold p-2 border border-gray-300',
  // Applied to the table while cells are drag-selected; styled in Editor.css to
  // suppress native text selection so the cell-range highlight reads clearly.
  tableSelection: 'editor-table-selection',
};

const editorConfig = {
  namespace: 'UserContentEditor',
  theme,
  onError(error) {
    throw error;
  },
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    LinkNode,
    CodeNode,
    CodeHighlightNode,
    HorizontalRuleNode,
    ImageNode,
    TableNode,
    TableRowNode,
    TableCellNode,
  ],
};

/**
 * Serialize the current editor state to the requested format. Must be called
 * inside an editorState.read()/editor.read() so the Lexical $ helpers have an
 * active state.
 *
 * @param {import('lexical').LexicalEditor} editor
 * @param {'html' | 'markdown'} format
 * @returns {string}
 */
function serializeContent(editor, format) {
  if (format === 'markdown') {
    // Curated transformer set; nodes without a Markdown form (tables, images,
    // horizontal rules) are omitted.
    return $convertToMarkdownString(EDITOR_TRANSFORMERS);
  }

  // Generate HTML with default export (no custom transformer), then strip the
  // theme's utility classes and Lexical's table sizing markup.
  return (
    $generateHtmlFromNodes(editor)
      .replace(/class="[^"]*"/g, '') // Remove all class attributes
      // List longer tags before their prefixes (pre before p) so the
      // alternation doesn't rewrite <pre> as <p>.
      .replace(/<(h[1-6]|pre|p|ul|ol|li|code|hr)([^>]*)>/g, '<$1>') // Clean heading, paragraph, list, code, and hr tags
      .replace(/<a([^>]*)(class="[^"]*")([^>]*)>/g, '<a$1$3>') // Clean link tags
      .replace(/<colgroup[^>]*>[\s\S]*?<\/colgroup>/g, '') // Drop Lexical's <colgroup>/<col> sizing markup
      .replace(/<(table|thead|tbody|tr)([^>]*)>/g, '<$1>') // Clean table structure tags
      .replace(/(<(?:td|th)\b[^>]*?)\s+style="[^"]*"/g, '$1') // Strip inline cell styles at any attribute position
      .replace(/(<(?:td|th)\b[^>]*?)\s+>/g, '$1>') // Tidy trailing whitespace left by attribute stripping
      // Header cells are all column headers (header row only), so scope="col".
      // The (?![a-z]) guard keeps this from matching <thead>.
      .replace(/<th(?![a-z])(?![^>]*\bscope=)([^>]*)>/g, '<th scope="col"$1>')
  ); // Ensure header cells carry scope
}

/**
 * Re-serialize and emit the current content when the output format changes, so
 * consumers see the new format immediately instead of only after the next edit.
 */
function OutputFormatSync({ outputFormat, onContentChange }) {
  const [editor] = useLexicalComposerContext();
  const isInitialRun = useRef(true);
  useEffect(() => {
    // Skip the mount run — OnChangePlugin already emits the initial content.
    // Only re-emit when the format actually changes afterward.
    if (isInitialRun.current) {
      isInitialRun.current = false;
      return;
    }
    editor.getEditorState().read(() => {
      onContentChange(serializeContent(editor, outputFormat));
    });
  }, [editor, outputFormat, onContentChange]);
  return null;
}

/**
 * Accessible rich-text editor.
 *
 * @param {object} props
 * @param {(content: string) => void} props.onContentChange Called on edit with the
 *   serialized content, in the format selected by `outputFormat`.
 * @param {'html' | 'markdown'} [props.outputFormat] Format passed to
 *   `onContentChange`: cleaned HTML (default) or Markdown. Markdown covers
 *   headings, lists, blockquotes, links, code (inline and fenced blocks), and
 *   bold/italic/strikethrough; nodes without a Markdown representation
 *   (tables, images, horizontal rules) are omitted from Markdown output.
 * @param {(file: File) => Promise<string>} [props.onImageUpload] Optional async
 *   upload handler. When provided, the Insert Image dialog gains a drag-and-drop
 *   zone and file picker; the handler receives the chosen File and must resolve
 *   to the URL to embed. When omitted, the dialog stays URL-only.
 * @param {string} [props.initialValue] Optional trusted HTML used to seed the
 *   editor once, on mount (e.g. a saved draft or a pre-filled template). The
 *   content is converted faithfully — images, tables, and code blocks are
 *   preserved. Later changes to this prop are ignored so user edits are never
 *   clobbered.
 * @param {boolean} [props.showOutline] Whether to render the Document Outline
 *   panel below the editing surface. Defaults to `false`, so the editor stays
 *   minimal chrome by default and suits short-form embedded fields (a reply
 *   box, a ticket description). Pass `true` for long-form authoring, where a
 *   live heading map earns its space.
 */
export default function Editor({
  onContentChange,
  outputFormat = 'html',
  onImageUpload,
  initialValue,
  showOutline = false,
}) {
  const { t } = useTranslation();
  const [showDocs, setShowDocs] = useState(false);
  const [, setHtmlOutput] = useState('');

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <ToolbarPlugin showDocs={showDocs} setShowDocs={setShowDocs} onImageUpload={onImageUpload} />

      <div className="editor-container">
        <div className="editor-content-area">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="editor-input" ariaLabel={t('editorContent')} />
            }
            placeholder={<div className="editor-placeholder">Start writing...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <HorizontalRulePlugin />
          <LinkPlugin validateUrl={isSafeUrl} />
          <ListPlugin />
          <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
          <PastePlugin />
          <TablePlugin />
          {initialValue ? <InitialContentPlugin html={initialValue} /> : null}
          <OnChangePlugin
            onChange={(editorState, editor) => {
              editorState.read(() => {
                const serialized = serializeContent(editor, outputFormat);
                setHtmlOutput(serialized);
                onContentChange(serialized);
              });
            }}
          />
          <OutputFormatSync outputFormat={outputFormat} onContentChange={onContentChange} />
        </div>
        {showOutline ? <HeadingOutlinePlugin /> : null}
        <WordCountPlugin />
      </div>

      {showDocs ? (
        <div className="editor-docs-overlay" aria-label="Editor documentation">
          <div className="editor-docs-content">
            <div className="editor-docs-header">
              <h2>Editor Shortcuts</h2>
              <button
                onClick={() => setShowDocs(false)}
                aria-label="Close documentation"
                className="close-docs-button"
              >
                &times;
              </button>
            </div>
            <div className="editor-docs-body">
              <p className="editor-docs-platform-note">
                On macOS, use <kbd>Cmd</kbd> (⌘) wherever <kbd>Ctrl</kbd> is shown.
              </p>
              <div className="shortcuts-sections">
                <section className="shortcuts-section">
                  <h3>Text formatting</h3>
                  <dl className="shortcuts-list">
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>B</kbd>
                      </dt>
                      <dd>Bold</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>I</kbd>
                      </dt>
                      <dd>Italic</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>U</kbd>
                      </dt>
                      <dd>Underline</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd>
                      </dt>
                      <dd>Strikethrough</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>E</kbd>
                      </dt>
                      <dd>Inline code</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>\</kbd>
                      </dt>
                      <dd>Clear formatting</dd>
                    </div>
                  </dl>
                </section>

                <section className="shortcuts-section">
                  <h3>Headings</h3>
                  <dl className="shortcuts-list">
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>1</kbd>–<kbd>6</kbd>
                      </dt>
                      <dd>Heading 1 through 6</dd>
                    </div>
                  </dl>
                </section>

                <section className="shortcuts-section">
                  <h3>Blocks &amp; lists</h3>
                  <dl className="shortcuts-list">
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>8</kbd>
                      </dt>
                      <dd>Bullet list</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>7</kbd>
                      </dt>
                      <dd>Numbered list</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Q</kbd>
                      </dt>
                      <dd>Blockquote</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd>
                      </dt>
                      <dd>Code block</dd>
                    </div>
                  </dl>
                </section>

                <section className="shortcuts-section">
                  <h3>Insert</h3>
                  <dl className="shortcuts-list">
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>K</kbd>
                      </dt>
                      <dd>Insert or edit link</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>
                      </dt>
                      <dd>Insert image</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd>
                      </dt>
                      <dd>Insert table</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>-</kbd>
                      </dt>
                      <dd>Horizontal rule</dd>
                    </div>
                  </dl>
                </section>

                <section className="shortcuts-section">
                  <h3>Editing</h3>
                  <dl className="shortcuts-list">
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                      </dt>
                      <dd>Undo</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> +{' '}
                        <kbd>Z</kbd>
                      </dt>
                      <dd>Redo</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>
                      </dt>
                      <dd>Paste as plain text</dd>
                    </div>
                  </dl>
                </section>

                <section className="shortcuts-section">
                  <h3>Help &amp; navigation</h3>
                  <dl className="shortcuts-list">
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Ctrl</kbd> + <kbd>D</kbd>
                      </dt>
                      <dd>Toggle this help dialog</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Esc</kbd>
                      </dt>
                      <dd>Close dialog / exit editor focus</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>←</kbd> / <kbd>→</kbd>
                      </dt>
                      <dd>Move between toolbar buttons</dd>
                    </div>
                    <div className="shortcut-row">
                      <dt>
                        <kbd>Home</kbd> / <kbd>End</kbd>
                      </dt>
                      <dd>First / last toolbar button</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <h3>Markdown auto-formatting</h3>
              <p>
                Type these and they convert as you go: <kbd>#</kbd>–<kbd>######</kbd> for headings,{' '}
                <kbd>&gt;</kbd> for a blockquote, <kbd>-</kbd> or <kbd>*</kbd> for a bullet list,{' '}
                <kbd>1.</kbd> for a numbered list, <kbd>**bold**</kbd>, <kbd>*italic*</kbd>,{' '}
                <kbd>`code`</kbd> for inline code, <kbd>```</kbd> for a code block, and{' '}
                <kbd>[text](url)</kbd> for links.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </LexicalComposer>
  );
}
