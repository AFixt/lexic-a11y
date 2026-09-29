// Type declarations for the server-side afixt-engine adapter
// (`@afixt/lexic-a11y/dist/afixt-engine.js`). Hand-maintained like index.d.ts
// and copied beside it by the build; `npm run types:check` compiles both.

import type { AccessibilityCheckRequest, AccessibilityIssue } from './index';

export type { AccessibilityCheckRequest, AccessibilityIssue };

/** The subset of `AccessibilityEngine` the adapter uses. */
export interface AccessibilityEngineLike {
  test(options: Record<string, unknown> & { html: string }): Promise<unknown>;
}

/**
 * Convert an `AccessibilityEngine#test()` result into the editor's issue list.
 * Only failing tests contribute.
 */
export declare function toAccessibilityIssues(result: unknown): AccessibilityIssue[];

/**
 * Build an `accessibilityChecker` backed by an engine the caller owns. Extra
 * `testOptions` (for example `standards`) are passed to every `engine.test()`.
 */
export declare function createAfixtEngineChecker(
  engine: AccessibilityEngineLike,
  testOptions?: Record<string, unknown>,
): (request: AccessibilityCheckRequest) => Promise<AccessibilityIssue[]>;
