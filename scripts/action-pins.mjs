/**
 * Parses and classifies the pinned GitHub Actions references in
 * .github/workflows. Pure logic only — no I/O — so it is unit-testable
 * (src/tests/action-pins.test.js). The CLI wrapper that resolves tags against
 * the GitHub API is scripts/check-action-pins.mjs; its exit code is covered
 * end to end by src/tests/check-action-pins.test.js against a stub API.
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
 * @property {string} [branch] The branch named by a `# <branch> @ <date>`
 *   comment — a deliberate branch pin, which has no tag to compare against.
 * @property {string} [pinnedAt] The date recorded alongside a branch pin.
 * @property {string} ref The raw ref after `@`, whether or not it is a SHA.
 */

/**
 * @typedef {(
 *   | {kind: 'current'}
 *   | {kind: 'stale', expected: string}
 *   | {kind: 'unresolved', reason: string}
 *   | {kind: 'unknown', reason: string}
 * )} PinStatus
 * current: pinned SHA matches what the tag resolves to today.
 * stale: the tag has moved since this was pinned.
 * unresolved: the pin has both a SHA and a `# <tag>` comment, so it *could*
 * have been checked, but the lookup failed — a deleted tag, a network error,
 * or a rate-limited or unauthorised API call. The check did not happen, which
 * is a failure of the check rather than a clean result (#140).
 * unknown: there was nothing to compare against in the first place — no SHA,
 * no tag comment, or a deliberate branch pin. Nothing is wrong and nothing
 * was missed.
 */

/**
 * @typedef {object} PinSummary
 * @property {number} total Every reference classified.
 * @property {number} current Pins whose SHA matches the tag today.
 * @property {number} stale Pins whose tag has moved.
 * @property {number} resolved Pins actually compared (current + stale).
 * @property {number} unresolved Pins that should have been compared but could not be.
 * @property {number} unknown Pins with nothing to compare against.
 * @property {boolean} ok True only when every checkable pin was checked and none is stale.
 */

/**
 * Case-insensitive on purpose: Git accepts an uppercase SHA and so does
 * `uses:`. The stored `sha` is lowercased at parse time so it compares equal
 * to the lowercase SHA the GitHub API answers with — with `i` alone an
 * uppercase pin would pass this test and then be reported stale against
 * itself (#124).
 */
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

/**
 * `uses: owner/repo[/subpath]@ref [# tag]`
 *
 * The reference is an ordinary YAML scalar, so it may be wrapped in single or
 * double quotes; the optional quote pair is matched and discarded. Without
 * that, a quoted reference did not match at all and vanished from the report
 * rather than being listed as unknown (#124).
 *
 * Docker (`docker://`) references have no upstream tag to compare against
 * and cannot match the owner/repo shape. Local references (`./.github/...`)
 * are excluded explicitly below: `./x/y@v1` would otherwise parse with
 * owner `.` and cost an API lookup against a repository that does not exist.
 */
/** The part of a `uses:` line before the reference, shared by both patterns. */
const USES_PREFIX = String.raw`^\s*(?:-\s+)?uses:\s*`;

const USES_PATTERN = new RegExp(
  USES_PREFIX +
    String.raw`(?<quote>["']?)(?<owner>[\w.-]+)\/(?<repo>[\w.-]+)(?<subpath>\/[\w./-]+)?@(?<ref>[^\s#"']+)\k<quote>\s*(?:#\s*(?<comment>.*))?$`,
);

/**
 * `# <branch> @ <YYYY-MM-DD>` — the fleet convention for a deliberate branch
 * pin (see the Dependency-Check_Action reference in security.yml). The date
 * records which HEAD was frozen; the branch name is not a tag and must not be
 * looked up as one, or the run would fail for a pin that is exactly as
 * intended (#140).
 */
const BRANCH_COMMENT = /^(?<branch>\S+)\s+@\s+(?<pinnedAt>\d{4}-\d{2}-\d{2})(?:\s|$)/;

const LOCAL_PATTERN = new RegExp(USES_PREFIX + String.raw`["']?\.\/`);

/**
 * Interpret the trailing `# ...` comment on a pinned reference.
 *
 * The first word is the tag the SHA claims to match, unless the comment is
 * the `# <branch> @ <date>` branch-pin form, in which case there is no tag
 * and the pin is recorded as a branch pin instead.
 *
 * @param {string | undefined} comment Everything after the `#`, if any.
 * @returns {{tag: string} | {branch: string, pinnedAt: string} | {}} What the comment declares.
 */
function parseComment(comment) {
  const text = comment?.trim() ?? '';
  if (text === '') return {};

  const branch = text.match(BRANCH_COMMENT);
  if (branch?.groups) {
    return { branch: branch.groups.branch, pinnedAt: branch.groups.pinnedAt };
  }

  // Only the first word of the comment is the tag; anything after it is prose.
  const [tag] = text.split(/\s/, 1);
  return { tag };
}

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
    if (LOCAL_PATTERN.test(rawLine)) return;

    const match = rawLine.match(USES_PATTERN);
    if (!match?.groups) return;

    const { owner, repo, ref, comment } = match.groups;
    const pinned = SHA_PATTERN.test(ref);

    pins.push({
      file,
      line: index + 1,
      owner,
      repo,
      ref,
      ...(pinned ? { sha: ref.toLowerCase() } : {}),
      // A tag comment on an unpinned ref is noise; only record it with a SHA.
      ...(pinned ? parseComment(comment) : {}),
    });
  });

  return pins;
}

/**
 * Compare one pin against the SHA its tag resolves to upstream.
 *
 * `resolvedSha` is undefined when the tag could not be resolved — a deleted
 * tag, a network error, or a rate-limited API call. For a pin carrying both
 * a SHA and a tag that is `unresolved`, not `unknown`: the comparison was
 * owed and did not happen, so the run must not report success (#140). It is
 * still not `stale`, because "we could not check" and "this is out of date"
 * warrant different responses. `failure`, when the caller has one, is
 * appended to the reason so a 404 on a deleted tag and a 403 from the rate
 * limiter stop reading identically (#124).
 *
 * A pin with nothing to compare against — no SHA, no tag comment, or a
 * deliberate branch pin — is `unknown` and harmless.
 *
 * @param {ActionPin} pin The parsed reference.
 * @param {string | undefined} resolvedSha What the tag points at today.
 * @param {string} [failure] Why resolution failed, e.g. `HTTP 403`.
 * @returns {PinStatus} How the pin compares.
 */
export function classifyPin(pin, resolvedSha, failure) {
  if (!pin.sha) {
    return {
      kind: 'unknown',
      reason: `not pinned to a SHA (points at "${pin.ref}")`,
    };
  }

  if (pin.branch) {
    return {
      kind: 'unknown',
      reason: `deliberately pinned to branch "${pin.branch}" (HEAD as of ${pin.pinnedAt}); a branch has no tag to compare against`,
    };
  }

  if (!pin.tag) {
    return {
      kind: 'unknown',
      reason: 'pinned to a SHA but has no "# <tag>" comment to check it against',
    };
  }

  if (!resolvedSha) {
    const detail = failure ? ` (${failure})` : '';
    return {
      kind: 'unresolved',
      reason: `tag "${pin.tag}" could not be resolved upstream${detail}, so this pin was not checked`,
    };
  }

  return resolvedSha === pin.sha ? { kind: 'current' } : { kind: 'stale', expected: resolvedSha };
}

/**
 * Tally classified pins and decide whether the run succeeded.
 *
 * A run is only `ok` when nothing is stale *and* every pin that was supposed
 * to be checked actually was. Exiting 0 after resolving nothing — which is
 * what a rate-limited or unauthorised token produces — makes a broken check
 * indistinguishable from a clean one (#140).
 *
 * @param {PinStatus[]} statuses One status per reference, in any order.
 * @returns {PinSummary} The counts and the pass/fail decision.
 */
export function summarize(statuses) {
  const counts = { current: 0, stale: 0, unresolved: 0, unknown: 0 };

  for (const status of statuses) {
    if (!Object.hasOwn(counts, status.kind)) {
      // Fail loudly rather than tallying a state nobody decided the meaning
      // of. main() turns this into a non-zero exit.
      throw new TypeError(`unrecognised pin status: ${status.kind}`);
    }
    counts[status.kind] += 1;
  }

  return {
    total: statuses.length,
    ...counts,
    resolved: counts.current + counts.stale,
    // An allowlist, not a denylist. A status kind added later has to be named
    // here before it can pass — defaulting an undecided state to success is
    // exactly how the exit-0-having-checked-nothing bug arose.
    ok: counts.current + counts.unknown === statuses.length,
  };
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
