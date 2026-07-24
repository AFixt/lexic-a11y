// Uses the real @lexical/markdown module (no mocks) to validate that the
// curated transformer set only relies on node types the editor registers.
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import {
  CHECK_LIST,
  CODE,
  HEADING,
  HIGHLIGHT,
  INLINE_CODE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  UNORDERED_LIST,
} from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';

import { EDITOR_TRANSFORMERS } from '../utils/markdown-transformers';

// Must mirror editorConfig.nodes in src/components/Editor.js
const REGISTERED_NODES = [HeadingNode, ListNode, ListItemNode, QuoteNode, LinkNode, CodeNode];

describe('EDITOR_TRANSFORMERS', () => {
  it('includes the supported block transformers', () => {
    expect(EDITOR_TRANSFORMERS).toContain(HEADING);
    expect(EDITOR_TRANSFORMERS).toContain(QUOTE);
    expect(EDITOR_TRANSFORMERS).toContain(UNORDERED_LIST);
    expect(EDITOR_TRANSFORMERS).toContain(ORDERED_LIST);
    expect(EDITOR_TRANSFORMERS).toContain(LINK);
    // CodeNode is registered in the editor, so the ``` fence and `inline`
    // shortcuts must be wired (issue #81).
    expect(EDITOR_TRANSFORMERS).toContain(CODE);
    expect(EDITOR_TRANSFORMERS).toContain(INLINE_CODE);
  });

  it('only depends on node types registered in the editor', () => {
    EDITOR_TRANSFORMERS.forEach((transformer) => {
      const dependencies = transformer.dependencies || [];
      dependencies.forEach((dependency) => {
        expect(REGISTERED_NODES).toContain(dependency);
      });
    });
  });

  it('excludes transformers for unsupported features', () => {
    // CHECK_LIST requires check-list support, HIGHLIGHT has no theme styling
    expect(EDITOR_TRANSFORMERS).not.toContain(CHECK_LIST);
    expect(EDITOR_TRANSFORMERS).not.toContain(HIGHLIGHT);
  });

  it('wires real transformers whose triggers fire on the expected markdown', () => {
    // Behavioral check against the actual @lexical/markdown transformer objects:
    // the block triggers must recognize the markdown the user types.
    const heading = EDITOR_TRANSFORMERS.find((t) => t === HEADING);
    const unordered = EDITOR_TRANSFORMERS.find((t) => t === UNORDERED_LIST);
    const ordered = EDITOR_TRANSFORMERS.find((t) => t === ORDERED_LIST);
    const code = EDITOR_TRANSFORMERS.find((t) => t === CODE);

    expect(heading.regExp.test('# ')).toBe(true);
    expect(heading.regExp.test('### ')).toBe(true);
    expect(heading.regExp.test('plain text')).toBe(false);

    expect(unordered.regExp.test('- ')).toBe(true);
    expect(ordered.regExp.test('1. ')).toBe(true);

    expect(code.regExp.test('``` ')).toBe(true);
    expect(code.regExp.test('```js ')).toBe(true);
    expect(code.regExp.test('`` ')).toBe(false);
  });
});
