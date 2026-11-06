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
  // JSON round-trips every entry, so a name containing a comma stays one name
  const key = Array.isArray(allowedFormats) ? JSON.stringify(allowedFormats) : null;
  return useMemo(() => resolveAllowedFormats(key === null ? undefined : JSON.parse(key)), [key]);
}

// One pattern per heading level, each matching exactly that many `#`s. The
// capture group is what Lexical's HEADING transformer reads the level from.
const HEADING_LEVEL_PATTERNS = new Map([
  ['h1', /^(#)\s/],
  ['h2', /^(##)\s/],
  ['h3', /^(###)\s/],
  ['h4', /^(####)\s/],
  ['h5', /^(#####)\s/],
  ['h6', /^(######)\s/],
]);

// The shortcuts after the headings, in EDITOR_TRANSFORMERS order. Each group
// applies only when every format it names is allowed.
const FORMAT_TRANSFORMERS = [
  [['blockquote'], [QUOTE]],
  [['bulletList'], [UNORDERED_LIST]],
  [['numberedList'], [ORDERED_LIST]],
  [
    ['bold', 'italic'],
    [BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE],
  ],
  [['bold'], [BOLD_STAR, BOLD_UNDERSCORE]],
  [['code'], [INLINE_CODE]],
  [['italic'], [ITALIC_STAR, ITALIC_UNDERSCORE]],
  [['strikethrough'], [STRIKETHROUGH]],
  [['link'], [LINK]],
];

function headingTransformers(allowed) {
  const headings = HEADING_FORMATS.filter((format) => allowed.has(format));
  if (headings.length === HEADING_FORMATS.length) {
    return [HEADING];
  }
  // A subset gets one transformer per allowed level, so typing `#### ` does
  // nothing when H4 is not allowed.
  return headings.map((tag) => ({ ...HEADING, regExp: HEADING_LEVEL_PATTERNS.get(tag) }));
}

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
  const transformers = allowed.has('codeBlock') ? [CODE] : [];
  transformers.push(...headingTransformers(allowed));
  for (const [formats, group] of FORMAT_TRANSFORMERS) {
    if (formats.every((format) => allowed.has(format))) {
      transformers.push(...group);
    }
  }
  return transformers;
}
