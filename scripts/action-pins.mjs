/**
 * Parses and classifies the pinned GitHub Actions references in
 * .github/workflows. Pure logic only — no I/O — so it is unit-testable
 * (src/tests/action-pins.test.js). The CLI wrapper that resolves tags against
 * the GitHub API is scripts/check-action-pins.mjs.
 *
 * Why this exists: every action reference here is pinned to a commit SHA so a
 * tag cannot be silently repointed under us. That closed a real supply-chain
 * hole and created an unowned maintenance job in exchange — a pinned SHA is
 * immune to a hijacked tag, and equally immune to the security fixes that tag
 * would have carried. Dependabot used to own refreshing the pins; it is now
 * banned repo-wide along with every other scheduled automation (issue #98),
 * so this check is the mechanism instead of it.
 *
 * The comparison is between the pinned SHA and the tag recorded in the
 * trailing comment (`@<sha> # v4.4.0`). Actions publish fixes by moving their
 * floating tag, so "the tag now points somewhere else" is exactly the signal
 * worth having.
 *
 * Known limitation: this cannot see a new major. A repository pinned to v4
 * keeps resolving v4 even after upstream ships v5. Dependabot would have
 * caught that; a human reading release notes still has to.
 *
 * Ported from a11y-mcp's mcp-server/scripts/actionPins.ts (TypeScript there,
 * plain ESM here to match this repository's scripts/ idiom).
 */

/**
 * @typedef {object} ActionPin
 * @property {string} file Workflow file the reference was found in.
 * @property {number} line 1-based line number, so output pastes into an editor.
 * @property {string} owner GitHub owner of the action.
 * @property {string} repo Repository name of the action.
 * @property {string} [sha] The 40-char commit SHA the workflow pins, if pinned.
 * @property {string} [tag] The version recorded in the trailing comment.
 * @property {string} ref The raw ref after `@`, whether or not it is a SHA.
 */

/**
 * @typedef {(
 *   | {kind: 'current'}
 *   | {kind: 'stale', expected: string}
 *   | {kind: 'unknown', reason: string}
 * )} PinStatus
 * current: pinned SHA matches what the tag resolves to today.
 * stale: the tag has moved since this was pinned.
 * unknown: nothing to compare against — no SHA, no tag comment, or the tag
 * could not be resolved.
 */

const SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * `uses: owner/repo[/subpath]@ref [# tag]`
 *
 * Local (`./.github/actions/x`) and Docker (`docker://`) references have no
 * upstream tag to compare against and are skipped by the leading owner/repo
 * requirement.
 */
const USES_PATTERN =
  /^\s*(?:-\s+)?uses:\s*(?<owner>[\w.-]+)\/(?<repo>[\w.-]+)(?<subpath>\/[\w./-]+)?@(?<ref>[^\s#]+)\s*(?:#\s*(?<tag>\S+))?/;

/**
 * Pull every action reference out of one workflow file's text.
 *
 * @param {string} text The workflow file contents.
 * @param {string} file The file name, recorded on each pin for reporting.
 * @returns {ActionPin[]} Every `uses:` reference found.
 */
export function parseActionPins(text, file) {
  const pins = [];

  text.split('\n').forEach((rawLine, index) => {
    const match = rawLine.match(USES_PATTERN);
    if (!match?.groups) return;

    const { owner, repo, ref, tag } = match.groups;

    pins.push({
      file,
      line: index + 1,
      owner,
      repo,
      ref,
      // A tag comment on an unpinned ref is noise; only record it with a SHA.
      ...(SHA_PATTERN.test(ref) ? { sha: ref } : {}),
      ...(tag ? { tag } : {}),
    });
  });

  return pins;
}

/**
 * Compare one pin against the SHA its tag resolves to upstream.
 *
 * `resolvedSha` is undefined when the tag could not be resolved — a deleted
 * tag, a branch name in the comment, or a rate-limited API call. That is
 * reported as unknown rather than stale, because "we could not check" and
 * "this is out of date" warrant different responses.
 *
 * @param {ActionPin} pin The parsed reference.
 * @param {string | undefined} resolvedSha What the tag points at today.
 * @returns {PinStatus} How the pin compares.
 */
export function classifyPin(pin, resolvedSha) {
  if (!pin.sha) {
    return {
      kind: 'unknown',
      reason: `not pinned to a SHA (points at "${pin.ref}")`,
    };
  }

  if (!pin.tag) {
    return {
      kind: 'unknown',
      reason: 'pinned to a SHA but has no "# <tag>" comment to check it against',
    };
  }

  if (!resolvedSha) {
    return { kind: 'unknown', reason: `tag "${pin.tag}" could not be resolved upstream` };
  }

  return resolvedSha === pin.sha ? { kind: 'current' } : { kind: 'stale', expected: resolvedSha };
}

/**
 * `owner/repo` — the key a tag is resolved against.
 *
 * @param {ActionPin} pin The parsed reference.
 * @returns {string} The repository slug.
 */
export function repoSlug(pin) {
  return `${pin.owner}/${pin.repo}`;
}
