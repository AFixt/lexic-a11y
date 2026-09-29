// The server-side afixt-engine adapter (issue #155). The fixture is a real
// @afixt/afixt-engine 6.1.1 result (standards: '*'), captured from the document
// in its `input` field and trimmed to the failing tests plus one passing and
// one not-applicable test.
import { createAfixtEngineChecker, toAccessibilityIssues } from '../afixt-engine';
import { locateIssue, parseCheckDocument } from '../utils/a11y-check-document';

import fixture from './__fixtures__/afixt-engine-result.json';

describe('toAccessibilityIssues', () => {
  const issues = toAccessibilityIssues(fixture);

  it('reports only failing tests, one entry per engine issue', () => {
    expect(issues.map((issue) => issue.ruleId)).toEqual(['NON-TEXT-CONTENT-01', 'STRUCTURE-08']);
  });

  it('maps the engine fields onto the editor issue shape', () => {
    const [image, heading] = issues;

    expect(image).toEqual({
      id: fixture.tests[0].issues[0].issueId,
      ruleId: 'NON-TEXT-CONTENT-01',
      title: 'Image(s) are missing text alternatives',
      description: '`<img>` has no text alternative',
      remediation: expect.any(String),
      severity: 'High',
      wcag: ['1.1.1 Non-text Content'],
      needsReview: true,
      xpath: '/html[1]/body[1]/main[1]/p[1]/img[1]',
      selector: 'html > body > main > p > img',
      helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    });

    // A best-practice (AUX) rule has no WCAG criterion, and an automatic rule
    // needs no human confirmation.
    expect(heading.wcag).toEqual([]);
    expect(heading.needsReview).toBe(false);
    expect(heading.description).toBe('Heading level skips from H1 to H4 (skipped H2)');
  });

  it('points every finding at an element of the content it was run on', () => {
    const doc = parseCheckDocument(fixture.input);
    expect(issues.map((issue) => locateIssue(doc, issue))).toEqual([
      { kind: 'content', ref: 5 },
      { kind: 'content', ref: 2 },
    ]);
  });

  it('ignores tests that reached no verdict, and tolerates an empty result', () => {
    const result = {
      tests: [
        { id: 'AI-1', status: 'ai_skipped', issues: [{ issueId: 'x' }] },
        { id: 'AI-2', status: 'ai_error', issues: [{ issueId: 'y' }] },
        { id: 'NONE', status: 'fail', issues: [] },
      ],
    };
    expect(toAccessibilityIssues(result)).toEqual([]);
    expect(toAccessibilityIssues(undefined)).toEqual([]);
    expect(toAccessibilityIssues({})).toEqual([]);
  });

  it('fills gaps: fallback id, title and description, object remediation and references', () => {
    const [only] = toAccessibilityIssues({
      tests: [
        {
          id: 'RULE-1',
          type: 'automatic',
          checkTitle: 'Check title',
          impactStatement: 'Why it matters',
          references: ['not a link', { title: 'Docs', url: 'https://example.com/docs' }],
          issues: [{ remediation: { description: 'Fix it like this' }, location: {} }],
        },
      ],
    });

    expect(only).toMatchObject({
      id: 'RULE-1-0',
      title: 'Check title',
      description: 'Why it matters',
      remediation: 'Fix it like this',
      helpUrl: 'https://example.com/docs',
      wcag: [],
    });
    expect(only.xpath).toBeUndefined();
  });
});

describe('createAfixtEngineChecker', () => {
  it('runs the engine on the submitted document with the configured options', async () => {
    const engine = { test: jest.fn().mockResolvedValue(fixture) };
    const check = createAfixtEngineChecker(engine, { standards: '*', html: 'ignored' });

    const issues = await check({ html: fixture.input });

    expect(engine.test).toHaveBeenCalledWith({ standards: '*', html: fixture.input });
    expect(issues).toHaveLength(2);
  });

  it('rejects a missing engine and an empty request', async () => {
    expect(() => createAfixtEngineChecker({})).toThrow(TypeError);
    const check = createAfixtEngineChecker({ test: jest.fn() });
    await expect(check({ html: '' })).rejects.toThrow(TypeError);
    await expect(check(undefined)).rejects.toThrow(TypeError);
  });
});
