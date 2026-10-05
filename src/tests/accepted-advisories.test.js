/**
 * Pins every advisory accepted in the OWASP Dependency-Check gate
 * (.dependency-check-suppressions.xml, AFixt/fleet-security#4) to its scope,
 * its expiry and its reason.
 *
 * A suppression is a decision about one package version and one advisory with
 * no fixed release. This fails if an entry loses its reason, runs past the
 * fleet's acceptance window, suppresses something not listed here, or goes
 * stale because the accepted version has left the lockfile or reached the
 * production tree.
 *
 * Dependency-Check is the only gate here that needs an entry: `security:audit`
 * audits the production tree, which holds neither package, and the NPM Audit
 * job in security.yml reports without failing (`continue-on-error`).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
// Fixed in-repo paths, not input.
// eslint-disable-next-line security/detect-non-literal-fs-filename
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** The latest `until` a no-fix acceptance may carry (AFixt/fleet-security#4). */
const LATEST_UNTIL = '2026-12-02';

/**
 * Live `<suppress>` entries. XML comments are removed first, so the commented
 * example at the top of the file is not read as one.
 *
 * @param {string} xml Contents of .dependency-check-suppressions.xml.
 * @returns {Array<{until: string | null, notes: string, purl: string | null, names: string[]}>}
 *     One per entry.
 */
function parseSuppressions(xml) {
  const live = xml.replaceAll(/<!--[\s\S]*?-->/g, '');
  return [...live.matchAll(/<suppress\b([^>]*)>([\s\S]*?)<\/suppress>/g)].map(
    ([, attrs, body]) => ({
      until: /until="(\d{4}-\d{2}-\d{2})Z?"/.exec(attrs)?.[1] ?? null,
      notes: /<notes>([\s\S]*?)<\/notes>/.exec(body)?.[1] ?? '',
      purl: /<packageUrl[^>]*>([^<]+)<\/packageUrl>/.exec(body)?.[1] ?? null,
      names: [
        ...body.matchAll(/<(?:vulnerabilityName|cve)>([^<]+)<\/(?:vulnerabilityName|cve)>/g),
      ].map((m) => m[1]),
    }),
  );
}

/** Each accepted advisory and exactly what it applies to. */
const ACCEPTED = [
  {
    id: 'GHSA-vfj7-8cjw-p6xm',
    purl: String.raw`^pkg:npm/braces@3\.0\.3$`,
    lockKey: 'node_modules/braces',
    version: '3.0.3',
    until: '2026-12-02',
  },
  {
    id: 'GHSA-jmr9-qjv8-65gv',
    // NVD publishes this advisory as a CVE too, and Dependency-Check reports it
    // under that name, so the suppression has to carry both.
    nvdAliases: ['CVE-2026-56876'],
    purl: String.raw`^pkg:npm/extract-zip@2\.0\.1$`,
    lockKey: 'node_modules/extract-zip',
    version: '2.0.1',
    until: '2026-11-14',
  },
  {
    id: 'GHSA-7pqw-9j4j-h8q3',
    purl: String.raw`^pkg:npm/extract-zip@2\.0\.1$`,
    lockKey: 'node_modules/extract-zip',
    version: '2.0.1',
    until: '2026-11-14',
  },
];

const suppressions = parseSuppressions(read('.dependency-check-suppressions.xml'));
const lock = JSON.parse(read('package-lock.json'));

describe('Dependency-Check suppressions', () => {
  it('has entries to check, and ignores the commented example', () => {
    expect(suppressions.length).toBeGreaterThan(0);
    expect(suppressions.map((s) => s.purl)).not.toContain(String.raw`^pkg:npm/example@.*$`);
  });

  it('gives every entry a reason and an until date within the acceptance window', () => {
    const label = (entry) => `${entry.names.join(',')} until ${entry.until}`;
    // A reason is a paragraph, not a placeholder.
    expect(suppressions.filter((e) => e.notes.trim().length < 100).map(label)).toEqual([]);
    expect(
      suppressions.filter((e) => e.until === null || e.until > LATEST_UNTIL).map(label),
    ).toEqual([]);
  });

  it('suppresses nothing that is not listed as accepted here', () => {
    const accepted = new Set(ACCEPTED.flatMap((a) => [a.id, ...(a.nvdAliases ?? [])]));
    const suppressed = suppressions.flatMap((s) => s.names);
    expect(suppressed.filter((name) => !accepted.has(name))).toEqual([]);
  });
});

describe.each(ACCEPTED)(
  'accepted advisory $id',
  ({ id, nvdAliases = [], purl, lockKey, version, until }) => {
    const entry = suppressions.find((s) => s.names.includes(id));

    it('is suppressed for exactly that package version, until that date', () => {
      expect(entry).toBeDefined();
      expect(entry.names).toEqual(expect.arrayContaining(nvdAliases));
      expect(entry.purl).toBe(purl);
      expect(entry.until).toBe(until);
      expect(entry.notes).toContain(id);
    });

    it('still applies: the accepted version is the one in the lockfile', () => {
      const locked = lock.packages[lockKey];
      expect({ lockKey, version: locked?.version }).toEqual({ lockKey, version });
    });

    it('stays out of the production tree, where nothing is accepted', () => {
      const copies = Object.entries(lock.packages).filter(
        ([key]) => key === lockKey || key.endsWith(`/${lockKey}`),
      );
      expect(copies.length).toBeGreaterThan(0);
      expect(copies.filter(([, pkg]) => pkg.dev !== true).map(([key]) => key)).toEqual([]);
    });
  },
);
