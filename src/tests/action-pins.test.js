/**
 * Tests for the pure parsing/classification half of the action-pin freshness
 * check (scripts/action-pins.mjs). The network half (resolving tags against
 * the GitHub API) lives in scripts/check-action-pins.mjs and is exercised by
 * running the CLI, not here.
 */
import { classifyPin, parseActionPins, repoSlug } from '../../scripts/action-pins.mjs';

describe('parseActionPins', () => {
  it('extracts a SHA-pinned reference with its tag comment and line number', () => {
    const yaml = [
      'jobs:',
      '  build:',
      '    steps:',
      '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
    ].join('\n');

    const pins = parseActionPins(yaml, 'security.yml');

    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({
      file: 'security.yml',
      line: 4,
      owner: 'actions',
      repo: 'checkout',
      sha: '11d5960a326750d5838078e36cf38b85af677262',
      tag: 'v4.4.0',
    });
  });

  it('records a subpath action (e.g. codeql-action/init) under its repo', () => {
    const yaml =
      '      - uses: github/codeql-action/init@c4dd10e44af883a891fe31ced449bcb4a6728b9b # v3.37.6';

    const pins = parseActionPins(yaml, 'security.yml');

    expect(pins).toHaveLength(1);
    expect(repoSlug(pins[0])).toBe('github/codeql-action');
    expect(pins[0].tag).toBe('v3.37.6');
  });

  it('keeps an unpinned (tag) reference but records no sha', () => {
    const pins = parseActionPins('      - uses: actions/setup-node@v4', 'ci.yml');

    expect(pins).toHaveLength(1);
    expect(pins[0].sha).toBeUndefined();
    expect(pins[0].ref).toBe('v4');
  });

  it('ignores lines that are not uses: references', () => {
    const yaml = ['      - run: npm test', '        env:', '          FOO: bar@baz # v1'].join(
      '\n',
    );

    expect(parseActionPins(yaml, 'ci.yml')).toHaveLength(0);
  });
});

describe('classifyPin', () => {
  const pinned = {
    file: 'security.yml',
    line: 1,
    owner: 'actions',
    repo: 'checkout',
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    tag: 'v4.4.0',
    ref: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };

  it('reports current when the tag still resolves to the pinned sha', () => {
    expect(classifyPin(pinned, pinned.sha)).toEqual({ kind: 'current' });
  });

  it('reports stale with the expected sha when the tag has moved', () => {
    const moved = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    expect(classifyPin(pinned, moved)).toEqual({ kind: 'stale', expected: moved });
  });

  it('reports unknown when the reference is not SHA-pinned', () => {
    const unpinned = { ...pinned, sha: undefined, ref: 'v4' };

    expect(classifyPin(unpinned, 'anything')).toMatchObject({ kind: 'unknown' });
  });

  it('reports unknown when there is no tag comment to compare against', () => {
    const untagged = { ...pinned, tag: undefined };

    expect(classifyPin(untagged, undefined)).toMatchObject({ kind: 'unknown' });
  });

  it('reports unknown, not stale, when the tag could not be resolved', () => {
    expect(classifyPin(pinned, undefined)).toMatchObject({ kind: 'unknown' });
  });
});
