import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

// Import the editor directly from source
import { $generateHtmlFromNodes } from '@lexical/html';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HeadingNode } from '@lexical/rich-text';

// Import the simplified toolbar component created for this sandbox
import ToolbarPlugin from './ToolbarPlugin';

// Editor theme configuration
const theme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
  },
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
};

// Editor configuration
const editorConfig = {
  namespace: 'LexicA11yDemo',
  theme,
  onError: (error) => console.error(error),
  nodes: [HeadingNode, ListNode, ListItemNode, LinkNode],
};

// Main App Component
export default function App() {
  const [content, setContent] = useState('');

  const onChange = (editorState) => {
    editorState.read(() => {
      const htmlString = $generateHtmlFromNodes(editorState);
      setContent(htmlString);
    });
  };

  return (
    <I18nextProvider i18n={i18n}>
      <div className="container">
        <h1>Lexical Accessible Editor Demo</h1>
        <p>An accessible, internationalized rich text editor for React, built on Lexical.</p>

        <div className="editor-container">
          <LexicalComposer initialConfig={editorConfig}>
            <ToolbarPlugin />
            <div className="editor-content-area">
              <RichTextPlugin
                contentEditable={<ContentEditable className="editor-input" />}
                placeholder={<div className="editor-placeholder">Start typing here...</div>}
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <OnChangePlugin onChange={onChange} />
              <LinkPlugin />
              <ListPlugin />
            </div>
          </LexicalComposer>
        </div>

        <div className="output-container">
          <h2>Generated HTML</h2>
          <pre className="html-output">{content}</pre>
        </div>
      </div>
    </I18nextProvider>
  );
}
