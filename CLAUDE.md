# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

- React-based rich text editor using Lexical
- Accessibility-focused implementation with ARIA attributes
- i18n support via react-i18next

## Commands

- Install: `npm install` (run `bash scripts/bootstrap.sh` first on a fresh clone
  — it installs trufflehog/osv-scanner/semgrep/lychee via Homebrew).
- Start dev server: `npm start`
- Build package: `npm run build`
- Analyze bundle: `npm run build:analyze` (writes `reports/bundle-stats.html`)
- Run tests: `npm test`
- Run tests with watch: `npm run test:watch`
- Smoke-test the built bundles: `npm run test:dist` (needs `npm run build` first
  — it mounts the real `dist/` ESM and CJS artifacts in jsdom, which the source
  suite cannot do)
- Lint code: `npm run lint` (JS), `npm run lint:css`, `npm run lint:md`
- Format: `npm run format`
- Check bundle size: `npm run size`
- Full local gate: `npm run check:all` (runs check + test + build + dupes +
  size + license + audit + secrets)

## Tooling

- ESLint flat config in `eslint.config.mjs` — includes react, sonarjs, security,
  unicorn, import-x, promise, n, jsdoc, no-secrets. Structural rules
  (complexity, max-depth, cognitive-complexity) are **warnings** so pre-existing
  code smell doesn't block new work; the errors tier is reserved for correctness
  and security.
- Babel presets live **only** in `babel.config.js` — never re-declare them in
  `rollup.config.js`'s `babel()` options. Babel merges same-named presets and
  the programmatic options win, so repeating `@babel/preset-react` there
  silently drops `runtime: 'automatic'` and compiles the bundles to a bare
  `React.createElement` with nothing bound in scope (issue #80).
- Prettier config in `.prettierrc.json` (note: MD049 in
  `.markdownlint-cli2.jsonc` aligns with Prettier's default underscore
  emphasis).
- Stylelint a11y rules are set to `severity: warning` for the same reason as
  ESLint.
- Husky hooks: `pre-commit` (lint-staged + trufflehog), `commit-msg`
  (commitlint), `pre-push` (`npm run check`), `post-merge` (audit on lockfile
  change).

## Git Workflow

This project follows **Git Flow**. You MUST adhere to this branching strategy:

- **`main`** — Production-ready code only. Never commit directly to main.
- **`develop`** — Integration branch. All feature work merges here first.
- **`feature/*`** — Branch off `develop` for new work. Name:
  `feature/<issue#>-<short-description>` (e.g.,
  `feature/7-repo-standardization`).
- **`hotfix/*`** — Branch off `main` for urgent production fixes. Merge back
  into both `main` and `develop`.
- **`release/*`** — Branch off `develop` when preparing a release. Merge into
  both `main` and `develop`.

### Rules

1. Always create a feature branch off `develop` before making changes.
2. Never push directly to `main` or `develop` — always use pull requests.
3. PR target for features: `develop`. PR target for hotfixes: `main`.
4. Delete feature branches after merging.

## Code Style Guidelines

- Use functional React components with hooks
- Import order: React/core libraries → third-party → local files
- File/component naming: PascalCase for components, camelCase for utilities
- Use destructuring for props and state
- Maintain accessibility features (ARIA roles, labels, keyboard support)
- Error handling: Use try/catch for async operations
- Ensure proper aria-\* attributes on interactive elements
- Follow i18n patterns using react-i18next's useTranslation hook
- Always provide alt text for images and proper ARIA attributes

## Reviewing PRs

Whenever I ask to review a PR (pull request), use the `pr-review` skill.

## axe-core is banned

**`axe-core` must never be used in this project — directly or transitively.**

- Do not add `axe-core` or any `@axe-core/*` package.
- Do not add any dependency that pulls in `axe-core` transitively — this
  includes `eslint-plugin-jsx-a11y`, `lighthouse` / `@lhci/cli`, `pa11y`,
  `@storybook/addon-a11y`, `jest-axe`, `cypress-axe`, and similar.
- Before adding any new dependency, verify with `npm ls axe-core` that it does
  not introduce axe-core into the tree. If it does, do not add it.
- Use `@afixt/a11y-assert` for accessibility checks instead.
