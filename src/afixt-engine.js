// Server-side adapter between @afixt/afixt-engine and the editor's
// `accessibilityChecker` prop (issue #155).
//
// Published as its own entry — `@afixt/lexic-a11y/dist/afixt-engine.js` (CJS)
// and `dist/afixt-engine.esm.js` — never from the editor bundle. The engine
// drives a headless browser (Puppeteer), so it can only run in Node, not in the
// page the editor is embedded in. This module therefore does not import the
// engine at all: the host constructs and owns an `AccessibilityEngine` (and
// its lifecycle — `close()` it on shutdown) and hands it in. That keeps this
// MIT package free of the engine's licence and install weight; hosts without
// access to @afixt/afixt-engine never load it.
//
// Typical wiring, in the host's server:
//
//   const { AccessibilityEngine } = require('@afixt/afixt-engine');
//   const { createAfixtEngineChecker } = require('@afixt/lexic-a11y/dist/afixt-engine.js');
//   const check = createAfixtEngineChecker(new AccessibilityEngine());
//   app.post('/api/a11y-check', async (req, res) => res.json(await check(req.body)));
//
// and in the page: `<Editor accessibilityChecker={postTo('/api/a11y-check')} />`.

/** A test result `status` whose issues are real findings. */
const FAILING = 'fail';

/**
 * Turn an engine reference into `{ title, url }`. The engine emits Markdown
 * links (`[Understanding … | WCAG 2.2](https://…)`); plain objects are accepted
 * too so a future engine that structures them keeps working.
 * @param {unknown} reference one entry of a test's `references`.
 * @returns {{ title: string, url: string } | null} the link, or null.
 */
function parseReference(reference) {
  if (reference && typeof reference === 'object' && typeof reference.url === 'string') {
    return { title: String(reference.title || reference.url), url: reference.url };
  }
  const match = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(String(reference ?? '').trim());
  return match ? { title: match[1], url: match[2] } : null;
}

/**
 * The WCAG success criteria a test maps to, e.g. `['1.1.1 Non-text Content']`.
 * @param {object} test a compiled engine test result.
 * @returns {string[]} the criteria, de-duplicated.
 */
function wcagCriteria(test) {
  const criteria = (test.applicableStandards || [])
    .filter((standard) => /wcag/i.test(`${standard.id || ''} ${standard.name || ''}`))
    .map((standard) => standard.success_criteria && standard.success_criteria.short)
    .filter(Boolean);
  return [...new Set(criteria)];
}

/**
 * Read a remediation that may be a string or `{ description }`.
 * @param {unknown} value an engine issue's `remediation`.
 * @returns {string | undefined} the text, if any.
 */
function remediationText(value) {
  if (typeof value === 'string') return value || undefined;
  if (value && typeof value.description === 'string') return value.description || undefined;
  return undefined;
}

/**
 * Convert an `AccessibilityEngine#test()` result into the editor's issue list.
 *
 * Only failing tests contribute: `pass`, `n/a`, and the AI lanes that reached
 * no verdict (`ai_skipped`, `ai_error`) report nothing actionable. Each issue
 * keeps the engine's `xpath` and `selector` so the editor can place it back on
 * the element it was found on.
 *
 * @param {object} result the value `engine.test()` resolved to.
 * @returns {object[]} issues in the shape `AccessibilityIssue` describes.
 */
export function toAccessibilityIssues(result) {
  const tests = result && Array.isArray(result.tests) ? result.tests : [];
  return tests.filter(isFailingWithIssues).flatMap(issuesOf);
}

/**
 * Whether a test contributes findings.
 * @param {object} test a compiled engine test result.
 * @returns {boolean} whether the test failed and located something.
 */
function isFailingWithIssues(test) {
  const found = Array.isArray(test.issues) ? test.issues : [];
  return found.length > 0 && (!test.status || test.status === FAILING);
}

/**
 * Map one failing test's issues to the editor's shape.
 * @param {object} test a failing compiled engine test result.
 * @returns {object[]} one editor issue per engine issue.
 */
function issuesOf(test) {
  const wcag = wcagCriteria(test);
  const references = (test.references || []).map(parseReference).filter(Boolean);
  const helpUrl = references.length > 0 ? references[0].url : undefined;
  const title = test.issueTitle || test.checkTitle || test.id;
  const fallbackDescription = test.impactStatement || test.description || undefined;

  return test.issues.map((issue, index) => {
    const location = issue.location || {};
    return {
      id: issue.issueId || `${test.id}-${index}`,
      ruleId: test.id,
      title,
      description: issue.details || fallbackDescription,
      remediation: remediationText(issue.remediation),
      severity: test.severity || undefined,
      wcag,
      // `automatic` rules decide on their own; `auto_assisted` and `manual`
      // findings are candidates a person has to confirm.
      needsReview: test.type !== 'automatic',
      xpath: location.xpath || undefined,
      selector: location.selector || undefined,
      helpUrl,
    };
  });
}

/**
 * Build an `accessibilityChecker` backed by an AccessibilityEngine instance.
 *
 * @param {{ test: (options: object) => Promise<object> }} engine an
 *   `AccessibilityEngine` (or anything with the same `test()`), owned by the
 *   caller.
 * @param {object} [testOptions] extra options for every `engine.test()` call,
 *   e.g. `{ standards: [{ id: 'WCAG', level: 'AA' }] }`. `html` is always the
 *   document the editor sent.
 * @returns {(request: { html: string }) => Promise<object[]>} the checker.
 */
export function createAfixtEngineChecker(engine, testOptions = {}) {
  if (!engine || typeof engine.test !== 'function') {
    throw new TypeError('createAfixtEngineChecker needs an AccessibilityEngine instance.');
  }

  return async function checkAccessibility(request) {
    const html = request && request.html;
    if (typeof html !== 'string' || html.length === 0) {
      throw new TypeError('The accessibility check request must carry a non-empty `html` string.');
    }
    const result = await engine.test({ ...testOptions, html });
    return toAccessibilityIssues(result);
  };
}
