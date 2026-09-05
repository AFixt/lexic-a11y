/**
 * Tests for the pure parsing/classification half of the action-pin freshness
 * check (scripts/action-pins.mjs). The network half (resolving tags against
 * the GitHub API) lives in scripts/check-action-pins.mjs and is exercised end
 * to end, exit code included, in check-action-pins.test.js.
 */
import fs from 'node:fs';
import path from 'node:path';

import { classifyPin, parseActionPins, repoSlug, summarize } from '../../scripts/action-pins.mjs';

const WORKFLOW_DIR = path.join(__dirname, '..', '..', '.github', 'workflows');

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

  it('reports unresolved, not stale and not unknown, when the tag could not be resolved (#140)', () => {
    // The comparison was owed and did not happen. Folding this into
    // `unknown` is what let a dead token report a clean bill of health.
    expect(classifyPin(pinned, undefined)).toMatchObject({ kind: 'unresolved' });
  });
});

describe('parseActionPins — reference forms that used to be mis-parsed (#124)', () => {
  const sha = '11d5960a326750d5838078e36cf38b85af677262';

  it.each([
    ['double-quoted', `      - uses: "actions/checkout@${sha}" # v4.4.0`],
    ['single-quoted', `      - uses: 'actions/checkout@${sha}' # v4.4.0`],
  ])('keeps a %s reference instead of dropping it', (_label, line) => {
    const pins = parseActionPins(line, 'ci.yml');

    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ owner: 'actions', repo: 'checkout', sha, tag: 'v4.4.0' });
  });

  it('parses a quoted, unpinned reference without the quote bleeding into the ref', () => {
    const pins = parseActionPins(`      - uses: "actions/checkout@v4"`, 'ci.yml');

    expect(pins[0].ref).toBe('v4');
  });

  it('recognises an uppercase SHA and stores it lowercased so it compares equal upstream', () => {
    const pins = parseActionPins(
      `      - uses: actions/checkout@${sha.toUpperCase()} # v4.4.0`,
      'ci.yml',
    );

    expect(pins[0].sha).toBe(sha);
    expect(classifyPin(pins[0], sha)).toEqual({ kind: 'current' });
  });

  it('skips a local action reference that carries an @ref', () => {
    expect(parseActionPins('      - uses: ./.github/actions/setup@v1', 'ci.yml')).toHaveLength(0);
  });

  it('skips a local action reference without an @ref', () => {
    expect(parseActionPins('      - uses: ./.github/actions/setup', 'ci.yml')).toHaveLength(0);
  });

  it('skips a docker:// reference', () => {
    expect(parseActionPins('      - uses: docker://alpine:3.20', 'ci.yml')).toHaveLength(0);
  });
});

describe('classifyPin — unresolved tag detail (#124)', () => {
  const pinned = {
    file: 'ci.yml',
    line: 1,
    owner: 'actions',
    repo: 'checkout',
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    tag: 'v6',
    ref: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };

  it('includes the failure (e.g. HTTP status) so a 403 and a 404 read differently', () => {
    expect(classifyPin(pinned, undefined, 'HTTP 403')).toEqual({
      kind: 'unresolved',
      reason: 'tag "v6" could not be resolved upstream (HTTP 403), so this pin was not checked',
    });
  });

  it('omits the parenthetical when no failure detail is supplied', () => {
    expect(classifyPin(pinned, undefined).reason).toBe(
      'tag "v6" could not be resolved upstream, so this pin was not checked',
    );
  });
});

describe('branch pins — `# <branch> @ <date>` (#140)', () => {
  const sha = '1e54355a8b4c8abaa8cc7d0b70aa655a3bb15a6c';
  const line = `        uses: dependency-check/Dependency-Check_Action@${sha} # main @ 2025-12-10`;

  it('records the branch and date instead of a tag', () => {
    const [pin] = parseActionPins(line, 'security.yml');

    expect(pin).toMatchObject({ sha, branch: 'main', pinnedAt: '2025-12-10' });
    expect(pin.tag).toBeUndefined();
  });

  it('classifies a branch pin as unknown — nothing to compare, so not a failure', () => {
    const [pin] = parseActionPins(line, 'security.yml');
    const status = classifyPin(pin, undefined, 'HTTP 404');

    expect(status.kind).toBe('unknown');
    expect(status.reason).toContain('branch "main"');
    expect(status.reason).toContain('2025-12-10');
  });

  it('still treats a bare word followed by prose as a tag, not a branch', () => {
    const [pin] = parseActionPins(
      `      - uses: actions/checkout@${sha} # v4.4.0 pinned deliberately`,
      'ci.yml',
    );

    expect(pin.tag).toBe('v4.4.0');
    expect(pin.branch).toBeUndefined();
  });

  it('does not mistake a tag comment with a stray @ for a branch pin', () => {
    // No ISO date after the @, so this is not the branch-pin form.
    const [pin] = parseActionPins(`      - uses: actions/checkout@${sha} # v4 @ latest`, 'ci.yml');

    expect(pin.tag).toBe('v4');
    expect(pin.branch).toBeUndefined();
  });

  it('records no tag for an empty trailing comment', () => {
    const [pin] = parseActionPins(`      - uses: actions/checkout@${sha} #`, 'ci.yml');

    expect(pin.tag).toBeUndefined();
    expect(pin.branch).toBeUndefined();
  });
});

describe('summarize (#140)', () => {
  const moved = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  it('counts each kind and treats stale plus current as actually resolved', () => {
    expect(
      summarize([
        { kind: 'current' },
        { kind: 'current' },
        { kind: 'stale', expected: moved },
        { kind: 'unknown', reason: 'no tag' },
      ]),
    ).toEqual({
      total: 4,
      current: 2,
      stale: 1,
      unresolved: 0,
      unknown: 1,
      resolved: 3,
      ok: false,
    });
  });

  it('passes when everything checkable was checked and nothing is stale', () => {
    const summary = summarize([
      { kind: 'current' },
      { kind: 'unknown', reason: 'not pinned to a SHA' },
    ]);

    expect(summary).toMatchObject({ resolved: 1, unresolved: 0, ok: true });
  });

  it('fails when every pin that should have been checked was not', () => {
    // The regression this exists for: an invalid or rate-limited token made
    // every reference unresolvable, and the run still exited 0.
    const summary = summarize(
      Array.from({ length: 38 }, () => ({ kind: 'unresolved', reason: 'HTTP 401' })),
    );

    expect(summary).toMatchObject({ total: 38, resolved: 0, unresolved: 38, ok: false });
  });

  it('fails when only some pins could not be checked', () => {
    // accessibility-highlighter's `.every()` guard misses this case: a run
    // where most pins resolve and one does not is still a run that did not
    // check everything it was supposed to.
    const summary = summarize([
      { kind: 'current' },
      { kind: 'current' },
      { kind: 'unresolved', reason: 'HTTP 403' },
    ]);

    expect(summary).toMatchObject({ resolved: 2, unresolved: 1, ok: false });
  });

  it('does not fail a run whose only uncheckable pins had nothing to compare', () => {
    expect(summarize([{ kind: 'unknown', reason: 'branch pin' }]).ok).toBe(true);
  });

  it('passes an empty run rather than throwing', () => {
    expect(summarize([])).toMatchObject({ total: 0, resolved: 0, ok: true });
  });

  it('refuses to tally a status kind nobody has decided the meaning of', () => {
    // The pass condition is an allowlist, so a new kind must be named before
    // it can pass. Throwing here becomes a non-zero exit in the CLI.
    expect(() => summarize([{ kind: 'probably-fine' }])).toThrow(TypeError);
  });
});

/**
 * Whether a workflow line is a `uses:` step, in either list-item or key form.
 *
 * @param {string} line One line of workflow YAML.
 * @returns {boolean} True for a `uses:` line.
 */
function isUsesLine(line) {
  const text = line.trim();
  return text.startsWith('uses:') || text.startsWith('- uses:');
}

/**
 * Read every workflow file in this repository.
 *
 * @returns {Array<{name: string, text: string}>} File name and contents.
 */
function readWorkflows() {
  return fs
    .readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => ({
      name,
      // Path comes from readdirSync over a fixed in-repo directory, not input.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      text: fs.readFileSync(path.join(WORKFLOW_DIR, name), 'utf8'),
    }));
}

describe("this repository's own workflows", () => {
  const sources = readWorkflows();
  const pins = sources.flatMap(({ name, text }) => parseActionPins(text, name));

  it('has workflow files to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('parses every uses: line — a silently dropped reference is an unchecked pin', () => {
    const rawUses = sources.flatMap(({ text }) => text.split('\n').filter(isUsesLine));

    // Nothing here is a local or docker reference, so every line survives.
    expect(pins).toHaveLength(rawUses.length);

    for (const pin of pins) {
      expect(pin.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(pin.owner).not.toMatch(/["']/);
      // Every pin is either checkable (has a tag) or a declared branch pin.
      expect(Boolean(pin.tag) !== Boolean(pin.branch)).toBe(true);
    }
  });

  it('classifies only the declared branch pin as unknown when every tag resolves', () => {
    const classified = pins.map((pin) => ({ pin, status: classifyPin(pin, pin.sha) }));
    const unknown = classified.filter(({ status }) => status.kind === 'unknown');

    expect(unknown.map(({ pin }) => repoSlug(pin))).toEqual([
      'dependency-check/Dependency-Check_Action',
    ]);
    expect(summarize(classified.map(({ status }) => status))).toMatchObject({
      unresolved: 0,
      unknown: 1,
      ok: true,
    });
  });
});
