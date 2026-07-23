// markdown-transformers.js
import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CODE,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from '@lexical/markdown';

// Markdown shortcut transformers curated to the node types actually
// registered in the editor (HeadingNode, ListNode/ListItemNode, QuoteNode,
// LinkNode, CodeNode) plus text formats the theme styles.
//
// Deliberately excluded:
// - CHECK_LIST (check lists are not supported)
// - HIGHLIGHT (the 'highlight' text format has no styling in the theme)
export const EDITOR_TRANSFORMERS = [
  // Element transformers (block-level)
  CODE,
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  // Text-format transformers (inline)
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  // Text-match transformers
  LINK,
];
