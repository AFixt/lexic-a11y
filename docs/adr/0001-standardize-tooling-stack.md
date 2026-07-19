# ADR 0001: Standardize tooling stack

- **Status:** Accepted
- **Date:** 2026-04-23
- **Deciders:** @karlgroves

## Context

Issue #14 proposed a consistent, budget-conscious tooling stack covering
linting, formatting, duplication detection, documentation, security, and
performance. The project previously used ESLint (legacy config), Prettier,
Stylelint, markdownlint, jscpd, and Husky, but with ad-hoc configuration that
did not catch all the categories of issues we care about (security,
accessibility beyond JSX, code smell, licensing, bundle size, secret leakage).

## Decision

We adopt the tooling listed in issue #14 with the following scope constraints:

- **No TypeScript migration** — the project stays on JavaScript. TS-specific
  rules and `tsconfig.json` are out of scope.
- **No test framework migration** — Jest stays. Vitest migration and
  `@afixt/a11y-assert` integration are deferred.
- **Express / SEO / SSR tooling is skipped** — this is a React library, not an
  application. Items like `helmet`, `zod`, `react-helmet-async`, `llms.txt`,
  `schema-dts`, and sitemap generation do not apply.
- **Structural lint rules are warnings, not errors**, for
  `max-lines`/`max-lines-per-function`/`complexity`/`cognitive-complexity`/
  `max-depth`/`jsx-a11y/prefer-tag-over-role`/`react/jsx-no-leaked-render`. The
  existing `ToolbarPlugin.js` exceeds several of these budgets; refactoring is
  separate from tooling adoption.
- **Stylelint a11y rules run at severity `warning`** for the same reason.
- **`lint` does not use `--max-warnings=0`**; `lint:strict` does. The strict
  form is available for future cleanup work.
- **jscpd threshold raised from 1% to 5%** to tolerate small, pre-existing
  shared code; sandbox/examples/root demo files are excluded from the
  duplication scan.
- **Security CVE scans (osv-scanner, semgrep) run manually or on schedule**, not
  as part of `check:all`. The existing dev-only vulnerabilities in Parcel's
  transitive dependencies would otherwise block every push.
- **`@afixt/a11y-assert`, Lighthouse CI, Playwright, React Compiler** are
  deferred. The first is testing-related (out of scope); the others are
  application concerns that do not fit a library.

## Consequences

### Positive

- One command (`npm run check:all`) runs the full local gate.
- ESLint flat config pulls in sonarjs, security, unicorn, import-x, promise, n,
  jsdoc, and no-secrets on top of the existing React and a11y plugins.
- Husky gates are layered: `pre-commit` (lint-staged + trufflehog — originally
  gitleaks, replaced per issue #17), `commit-msg` (commitlint), `pre-push`
  (`npm run check` + `lychee` Markdown link check), `post-merge` (audit on
  lockfile change).
- **Markdown link checking (`lychee`) runs locally at `pre-push`**, not as a
  scheduled GitHub Action. This keeps the feedback loop local (the issue's
  preference for Husky gates over Actions minutes) and surfaces broken links
  before a PR is opened. The check is **non-blocking and bounded**
  (`--max-retries 0 --timeout 10`, failure does not abort the push): external
  link rot and host rate-limit backoffs are outside the repo's control and must
  not be able to hang or block a developer's push. The hook also degrades
  gracefully when `lychee` is not installed.
- `size-limit` budgets (100 KB brotlied) enforce bundle discipline.
- License compliance via `license-checker-rseidelsohn` with an allowlist.

### Negative

- Existing accessibility smells (role="dialog", role="presentation", small
  font-sizes in CSS) surface as warnings that are not currently addressed. They
  should be tracked separately.
- `ToolbarPlugin.js` flags structural warnings (length, complexity, nesting). It
  needs refactoring, tracked separately.
- Bootstrap now requires Homebrew (`trufflehog`, `osv-scanner`, `semgrep`,
  `lychee`). The pre-commit hook degrades gracefully if `trufflehog` is absent
  but logs a warning.

### Follow-up status (as of 2026-07-19)

This section records what has since changed; the decision text above is left as
the snapshot it was at the time of the decision.

- **Playwright and `@afixt/a11y-assert` are no longer deferred.** Both were
  adopted afterward — a Playwright E2E suite with an axe scan
  (`npm run test:e2e`, `.github/workflows/e2e.yml`) and component-level
  accessibility assertions in `src/tests/accessibility.test.js`. Vitest,
  Lighthouse CI, and React Compiler remain deferred.
- The TypeScript decision was reaffirmed and recorded separately in
  [ADR 0002](./0002-remain-on-javascript.md).
- `size-limit` budgets have since been raised from 100 KB to 105 KB.

### Follow-ups

- Refactor `ToolbarPlugin.js` to bring it under the complexity thresholds.
- Fix the CSS a11y warnings (font-size thresholds, prefers-reduced-motion, focus
  states on hover selectors).
- Replace `role="dialog"`/`role="presentation"` JSX with native elements.
- Consider migrating tests to Vitest and integrating `@afixt/a11y-assert` at the
  component level once the above refactors land.

## References

- Issue: #14
- Templates: `docs/templates/ADR.md`, `docs/templates/README.md`
