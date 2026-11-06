// Uses the real @lexical/markdown module (no mocks) so the filtered shortcut
// list is checked against the actual transformer objects.
import {
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  CODE,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from '@lexical/markdown';
import { renderHook } from '@testing-library/react';

import {
  EDITOR_FORMATS,
  markdownShortcutTransformers,
  resolveAllowedFormats,
  useAllowedFormats,
} from '../utils/allowed-formats';
import { EDITOR_TRANSFORMERS } from '../utils/markdown-transformers';

describe('resolveAllowedFormats', () => {
  it('allows every format when the prop is omitted', () => {
    expect(resolveAllowedFormats(undefined)).toEqual(new Set(EDITOR_FORMATS));
  });

  it('allows nothing for an empty array', () => {
    expect(resolveAllowedFormats([]).size).toBe(0);
  });

  it('drops names it does not know', () => {
    expect(resolveAllowedFormats(['bold', 'sparkles', 'h7'])).toEqual(new Set(['bold']));
  });
});

describe('useAllowedFormats', () => {
  it('agrees with resolveAllowedFormats on a name containing a comma', () => {
    const { result } = renderHook(() => useAllowedFormats(['bold,italic', 'link']));

    expect(result.current).toEqual(resolveAllowedFormats(['bold,italic', 'link']));
    expect(result.current).toEqual(new Set(['link']));
  });

  it('keeps the same Set for an equal array with a new identity', () => {
    const { result, rerender } = renderHook(({ formats }) => useAllowedFormats(formats), {
      initialProps: { formats: ['bold', 'link'] },
    });
    const first = result.current;

    rerender({ formats: ['bold', 'link'] });
    expect(result.current).toBe(first);
  });

  it('allows every format when the prop is omitted', () => {
    const { result } = renderHook(() => useAllowedFormats(undefined));

    expect(result.current).toEqual(new Set(EDITOR_FORMATS));
  });
});

describe('markdownShortcutTransformers', () => {
  it('matches the full curated set when every format is allowed', () => {
    expect(markdownShortcutTransformers(resolveAllowedFormats(undefined))).toEqual(
      EDITOR_TRANSFORMERS,
    );
  });

  it('keeps only text, list and link shortcuts for that allowlist', () => {
    const transformers = markdownShortcutTransformers(
      resolveAllowedFormats([
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'bulletList',
        'numberedList',
        'link',
      ]),
    );

    expect(transformers).toEqual(expect.arrayContaining([UNORDERED_LIST, ORDERED_LIST, LINK]));
    expect(transformers).toEqual(expect.arrayContaining([BOLD_STAR, ITALIC_STAR, STRIKETHROUGH]));
    expect(transformers).toContain(BOLD_ITALIC_STAR);
    expect(transformers).not.toContain(HEADING);
    expect(transformers).not.toContain(QUOTE);
    expect(transformers).not.toContain(CODE);
    expect(transformers).not.toContain(INLINE_CODE);
    expect(transformers.some((transformer) => transformer.regExp?.test('# '))).toBe(false);
  });

  it('drops the combined bold-italic shortcut unless both are allowed', () => {
    const transformers = markdownShortcutTransformers(resolveAllowedFormats(['italic']));

    expect(transformers).toContain(ITALIC_STAR);
    expect(transformers).not.toContain(BOLD_STAR);
    expect(transformers).not.toContain(BOLD_ITALIC_STAR);
  });

  it('limits heading shortcuts to the allowed levels', () => {
    const transformers = markdownShortcutTransformers(resolveAllowedFormats(['h2', 'h4']));
    const matches = (text) => transformers.some((transformer) => transformer.regExp.test(text));

    expect(transformers).toHaveLength(2);
    expect(matches('## ')).toBe(true);
    expect(matches('#### ')).toBe(true);
    expect(matches('# ')).toBe(false);
    expect(matches('### ')).toBe(false);
    expect(matches('##### ')).toBe(false);
  });

  it('keeps the level a restricted heading shortcut reports to Lexical', () => {
    const [h3] = markdownShortcutTransformers(resolveAllowedFormats(['h3']));

    // HEADING.replace reads the level from the first capture group
    expect('### Title'.match(h3.regExp)[1]).toHaveLength(3);
    expect(h3.replace).toBe(HEADING.replace);
  });

  it('returns no shortcuts for an empty allowlist', () => {
    expect(markdownShortcutTransformers(resolveAllowedFormats([]))).toEqual([]);
  });
});
