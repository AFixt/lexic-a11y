/**
 * End-to-end tests for the CLI half of the action-pin freshness check
 * (scripts/check-action-pins.mjs): its exit code, which is the only thing CI
 * acts on.
 *
 * The script is run as a child process against a fixture workflows directory
 * and a stub GitHub API (GITHUB_API_URL), so the exit code observed here is
 * the exit code a workflow would see. The regression these exist for (#140):
 * a run in which every lookup failed — a dead token, a 403 rate limit, no
 * network — reported `0 stale` and exited 0. That is an all-clear the run
 * never earned.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'check-action-pins.mjs');

const SHA = '11d5960a326750d5838078e36cf38b85af677262';
const MOVED = '0123456789abcdef0123456789abcdef01234567';
const BRANCH_SHA = '1e54355a8b4c8abaa8cc7d0b70aa655a3bb15a6c';

const TAGGED_PIN = `      - uses: actions/checkout@${SHA} # v4.4.0`;
const BRANCH_PIN = `      - uses: dependency-check/Dependency-Check_Action@${BRANCH_SHA} # main @ 2025-12-10`;

let server;
let apiUrl;
let handler;
let dirs = [];

/**
 * Write a one-file workflows directory containing the given `uses:` lines.
 *
 * @param {string[]} lines The step lines to embed.
 * @returns {string} The directory path.
 */
function workflowDir(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'action-pins-'));
  dirs.push(dir);
  // The path is a fresh mkdtemp directory this test just created, not input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(
    path.join(dir, 'ci.yml'),
    ['jobs:', '  build:', '    steps:', ...lines, ''].join('\n'),
  );
  return dir;
}

/**
 * Run the CLI against a workflows directory and the stub API.
 *
 * Asynchronous on purpose: the stub server lives in this process, and a
 * spawnSync would block the event loop it needs to answer the child.
 *
 * @param {string} dir The workflows directory.
 * @returns {Promise<{status: number | null, stdout: string, stderr: string}>} The result.
 */
function run(dir) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, dir],
      {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_API_URL: apiUrl, GITHUB_TOKEN: '' },
        timeout: 60000,
      },
      (error, stdout, stderr) => {
        // execFile reports a non-zero exit as an error; the exit code is the
        // thing under test, so unwrap it rather than throwing.
        resolve({ status: error ? error.code : 0, stdout, stderr });
      },
    );
  });
}

/**
 * Stub API answering every ref lookup the same way.
 *
 * @param {number} status HTTP status to return.
 * @param {object} [body] JSON body for a 2xx response.
 * @returns {void}
 */
function respondWith(status, body = {}) {
  handler = (req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

// Each test boots a node process and, for the network-backed cases, a fetch
// against the stub. Alone that is under a second; under a full parallel
// suite on a loaded machine it has been measured at 20 s and more.
jest.setTimeout(90000);

beforeAll(async () => {
  server = http.createServer((req, res) => {
    // Close the socket with the response: the child exits as soon as its
    // event loop drains, and a kept-alive connection would hold it open —
    // and hold this worker open too, past server.close().
    res.setHeader('Connection', 'close');
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('check-action-pins exit code (#140)', () => {
  it('exits 0 when every tagged pin resolves to its pinned SHA', async () => {
    respondWith(200, { object: { sha: SHA, type: 'commit' } });

    const { status, stdout } = await run(workflowDir([TAGGED_PIN, TAGGED_PIN]));

    expect(stdout).toContain('2 references checked: 2 resolved (2 current, 0 stale)');
    expect(status).toBe(0);
  });

  it('exits 1 when a pin that carries both a SHA and a tag could not be resolved', async () => {
    // A dead token. Every lookup 401s; nothing was checked; the run must not
    // report success.
    respondWith(401, { message: 'Bad credentials' });

    const { status, stdout } = await run(workflowDir([TAGGED_PIN, TAGGED_PIN]));

    expect(stdout).toContain('0 resolved (0 current, 0 stale), 2 could not be resolved');
    expect(stdout).toContain('these pins were NOT checked');
    expect(status).toBe(1);
  });

  it('exits 1 when only some of the pins could not be resolved', async () => {
    let calls = 0;
    handler = (req, res) => {
      calls += 1;
      // Two distinct tags collapse to two lookups; fail the second only.
      const ok = calls === 1;
      res.writeHead(ok ? 200 : 403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ok ? { object: { sha: SHA, type: 'commit' } } : {}));
    };

    const { status, stdout } = await run(
      workflowDir([TAGGED_PIN, `      - uses: actions/checkout@${SHA} # v4.4.1`]),
    );

    expect(stdout).toContain('1 resolved (1 current, 0 stale), 1 could not be resolved');
    expect(status).toBe(1);
  });

  it('exits 1 when a tag has moved since it was pinned', async () => {
    respondWith(200, { object: { sha: MOVED, type: 'commit' } });

    const { status, stdout } = await run(workflowDir([TAGGED_PIN]));

    expect(stdout).toContain('1 resolved (0 current, 1 stale)');
    expect(stdout).toContain('Stale pins');
    expect(status).toBe(1);
  });

  it('exits 0 for a deliberate branch pin, which has nothing to compare against', async () => {
    // Nothing should even be looked up: the branch name is not a tag.
    handler = (req, res) => {
      res.writeHead(500);
      res.end('should not be called');
    };

    const { status, stdout } = await run(workflowDir([BRANCH_PIN]));

    expect(stdout).toContain('0 could not be resolved, 1 with nothing to compare against');
    expect(stdout).toContain('Nothing to compare against (not a failure)');
    expect(status).toBe(0);
  });

  it('exits 0 for a SHA pin with no tag comment, and says so, rather than failing', async () => {
    respondWith(500);

    const { status, stdout } = await run(workflowDir([`      - uses: actions/checkout@${SHA}`]));

    expect(stdout).toContain('1 with nothing to compare against');
    expect(status).toBe(0);
  });

  it('exits 1 without truncating the report when nothing resolves', async () => {
    // process.exit() drops queued stdout on a pipe; the advice paragraph is
    // the last thing printed, so its presence proves the report survived.
    respondWith(403, { message: 'API rate limit exceeded' });

    const { status, stdout } = await run(
      workflowDir(
        Array.from({ length: 40 }, (_, i) => `      - uses: org/action-${i}@${SHA} # v1`),
      ),
    );

    expect(stdout).toContain('(HTTP 403)');
    expect(stdout.trimEnd().endsWith('not because these pins are known to be wrong.')).toBe(true);
    expect(status).toBe(1);
  });

  it('exits 1 when the workflows directory has no references at all', async () => {
    respondWith(200);

    const { status, stderr } = await run(workflowDir([]));

    expect(stderr).toContain('No action references found');
    expect(status).toBe(1);
  });
});
