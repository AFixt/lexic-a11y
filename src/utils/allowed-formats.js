// allowed-formats.js
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
import { useMemo } from 'react';

// Every formatting control the toolbar can offer, in toolbar order. These are
// the values the Editor's `allowedFormats` prop accepts. Undo, redo, clear
// formatting and help are not formats: they are always shown.
export const EDITOR_FORMATS = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'codeBlock',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'link',
  'image',
  'table',
  'bulletList',
  'numberedList',
  'horizontalRule',
];

export const HEADING_FORMATS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Inline formats Lexical applies through FORMAT_TEXT_COMMAND, keyed by the
// command's payload. Ctrl/Cmd+B, +I and +U reach that command from Lexical's
// RichTextPlugin rather than from the toolbar, so the editor blocks disallowed
// ones at the command instead of at the shortcut.
export const TEXT_FORMATS = ['bold', 'italic', 'underline', 'strikethrough', 'code'];

/**
 * Resolve the `allowedFormats` prop into a Set. Omitting the prop allows every
 * format; names the editor does not know are ignored.
 *
 * @param {string[] | undefined} allowedFormats The Editor's `allowedFormats` prop.
 * @returns {Set<string>} The format names the editor offers.
 */
export function resolveAllowedFormats(allowedFormats) {
  if (!Array.isArray(allowedFormats)) {
    return new Set(EDITOR_FORMATS);
  }
  return new Set(allowedFormats.filter((format) => EDITOR_FORMATS.includes(format)));
}

/**
 * {@link resolveAllowedFormats} as a hook. Consumers often pass an inline
 * array, so the result is memoized on the array's contents, not its identity.
 *
 * @param {string[] | undefined} allowedFormats The Editor's `allowedFormats` prop.
 * @returns {Set<string>} The format names the editor offers.
 */
export function useAllowedFormats(allowedFormats) {
  const key = Array.isArray(allowedFormats) ? allowedFormats.join(',') : null;
  return useMemo(() => resolveAllowedFormats(key === null ? undefined : key.split(',')), [key]);
}

// One pattern per heading level, each matching exactly that many `#`s. The
// capture group is what Lexical's HEADING transformer reads the level from.
const HEADING_LEVEL_PATTERNS = {
  h1: /^(#)\s/,
  h2: /^(##)\s/,
  h3: /^(###)\s/,
  h4: /^(####)\s/,
  h5: /^(#####)\s/,
  h6: /^(######)\s/,
};

/**
 * Markdown auto-formatting transformers for the allowed formats. Only the
 * as-you-type shortcuts are filtered; serialization keeps the full set so
 * content that arrives another way (initialValue, paste) still exports.
 *
 * @param {Set<string>} allowed Result of {@link resolveAllowedFormats}.
 * @returns {import('@lexical/markdown').Transformer[]} Transformers for
 *   MarkdownShortcutPlugin.
 */
export function markdownShortcutTransformers(allowed) {
  const has = (format) => allowed.has(format);
  const headings = HEADING_FORMATS.filter(has);

  const transformers = [];
  if (has('codeBlock')) transformers.push(CODE);
  if (headings.length === HEADING_FORMATS.length) {
    transformers.push(HEADING);
  } else {
    // A subset gets one transformer per allowed level, so typing `#### ` does
    // nothing when H4 is not allowed.
    transformers.push(
      ...headings.map((tag) => ({ ...HEADING, regExp: HEADING_LEVEL_PATTERNS[tag] })),
    );
  }
  if (has('blockquote')) transformers.push(QUOTE);
  if (has('bulletList')) transformers.push(UNORDERED_LIST);
  if (has('numberedList')) transformers.push(ORDERED_LIST);
  if (has('bold') && has('italic')) transformers.push(BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE);
  if (has('bold')) transformers.push(BOLD_STAR, BOLD_UNDERSCORE);
  if (has('code')) transformers.push(INLINE_CODE);
  if (has('italic')) transformers.push(ITALIC_STAR, ITALIC_UNDERSCORE);
  if (has('strikethrough')) transformers.push(STRIKETHROUGH);
  if (has('link')) transformers.push(LINK);
  return transformers;
}
