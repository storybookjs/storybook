/**
 * Regression test for the race this lock exists to prevent: several OS processes reaching the same
 * expensive work at the same instant, as a dev server, the Vitest addon's child and a standalone
 * `vitest` run do at start-up. Without a lock all of them do it.
 *
 * Real temp directories and real child processes rather than memfs: memfs is per-process, so each
 * child would get its own empty filesystem and exclusion would be vacuously true. The work itself is
 * a stand-in, so the test stays fast.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const CHILD_COUNT = 3;
const CRITICAL_SECTION_MS = 150;
// Generous on purpose: a Windows CI agent starting three Node processes is slow, and a tight budget
// would turn scheduler noise into a failing test.
const TEST_TIMEOUT_MS = 60_000;

// A file:// URL, not a path: Node's ESM resolver rejects a Windows absolute path as a specifier.
const lockModule = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), 'file-lock.ts')
).href;

/**
 * One process doing work that must happen at most once: take the lock, do it only if this run has
 * not already, and journal each time it actually runs so the parent can count.
 */
const childSource = `
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { withFileLock } from ${JSON.stringify(lockModule)};

const [lockPath, outputPath, markerPath, journalPath] = process.argv.slice(2);
const RUN_ID = process.env.RUN_ID;
const markerRunId = () => { try { return readFileSync(markerPath, 'utf8').trim(); } catch { return undefined; } };

const outcome = await withFileLock(lockPath, async () => {
  if (markerRunId() === RUN_ID) {
    return;
  }
  appendFileSync(journalPath, \`ran \${process.pid}\\n\`);
  await new Promise((resolve) => setTimeout(resolve, ${CRITICAL_SECTION_MS}));
  writeFileSync(outputPath, JSON.stringify({ writtenBy: process.pid }));
  writeFileSync(markerPath, RUN_ID);
});

appendFileSync(journalPath, \`outcome \${process.pid} \${outcome}\\n\`);
`;

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sb-file-lock-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('withFileLock across processes', () => {
  it.each([
    ['from a cold start', false],
    ['when an earlier run already left its output behind', true],
  ])(
    'runs the work in exactly one process %s',
    async (_label, seedOutput) => {
      const childPath = join(workDir, 'child.mts');
      const lockPath = join(workDir, '.work.lock');
      const outputPath = join(workDir, 'output.json');
      const markerPath = join(workDir, '.work.run');
      const journalPath = join(workDir, 'journal.log');
      writeFileSync(childPath, childSource);
      writeFileSync(journalPath, '');
      if (seedOutput) {
        // Output left by an earlier run must not stop this run from doing the work exactly once.
        writeFileSync(outputPath, JSON.stringify({ writtenBy: 'an earlier run' }));
        writeFileSync(markerPath, 'an-earlier-run');
      }

      await Promise.all(
        Array.from({ length: CHILD_COUNT }, () =>
          execFileAsync(
            process.execPath,
            [childPath, lockPath, outputPath, markerPath, journalPath],
            { env: { ...process.env, RUN_ID: 'the-run-under-test' } }
          )
        )
      );

      const journal = readFileSync(journalPath, 'utf8').trim().split('\n');
      const ran = journal.filter((line) => line.startsWith('ran '));
      const outcomes = journal.filter((line) => line.startsWith('outcome '));

      // One execution across all three processes, and nobody gave up waiting for it.
      expect(ran).toHaveLength(1);
      expect(outcomes).toHaveLength(CHILD_COUNT);
      expect(outcomes.filter((line) => line.endsWith('ran'))).toHaveLength(CHILD_COUNT);
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
        writtenBy: expect.any(Number),
      });
    },
    TEST_TIMEOUT_MS
  );
});
