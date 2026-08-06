/**
 * Regression test for the cold-start race: several OS processes reaching "no documentation.json, run
 * Compodoc" at the same instant, as `storybook dev`, the Vitest addon's child and a standalone
 * `vitest` run do. Without a lock all of them run a whole-project scan.
 *
 * Real temp directories and real child processes rather than memfs: memfs is per-process, so each
 * child would get its own empty filesystem and exclusion would be vacuously true. Compodoc is not
 * spawned; the critical section is a stand-in.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const CHILD_COUNT = 3;
const CRITICAL_SECTION_MS = 150;
// Generous on purpose: a Windows CI agent starting three Node processes is slow, and a tight budget
// would turn scheduler noise into a failing test.
const TEST_TIMEOUT_MS = 60_000;

const lockModule = join(dirname(fileURLToPath(import.meta.url)), 'file-lock.ts');

/** One "Storybook process", shaped like `ensureCompodocDocumentation`: take the lock, generate only
 * if the output is still missing, and journal each actual run so the parent can count them. */
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
  appendFileSync(journalPath, \`run \${process.pid}\\n\`);
  await new Promise((resolve) => setTimeout(resolve, ${CRITICAL_SECTION_MS}));
  writeFileSync(outputPath, JSON.stringify({ writtenBy: process.pid }));
  writeFileSync(markerPath, RUN_ID);
});

appendFileSync(journalPath, \`outcome \${process.pid} \${outcome}\\n\`);
`;

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sb-compodoc-lock-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('cross-process Compodoc lock', () => {
  it.each([
    ['from a cold start', false],
    ['when an earlier run already left a documentation.json', true],
  ])(
    'runs the work in exactly one process %s',
    async (_label, seedOutput) => {
      const childPath = join(workDir, 'child.mts');
      const lockPath = join(workDir, '.compodoc.lock');
      const outputPath = join(workDir, 'documentation.json');
      const markerPath = join(workDir, '.compodoc.run');
      const journalPath = join(workDir, 'journal.log');
      writeFileSync(childPath, childSource);
      writeFileSync(journalPath, '');
      if (seedOutput) {
        // The common case once a project has been built before: a documentation.json from an earlier
        // run is present, and must not stop this run from scanning exactly once.
        writeFileSync(outputPath, JSON.stringify({ writtenBy: 'an earlier run' }));
        writeFileSync(markerPath, 'an-earlier-run');
      }

      await Promise.all(
        Array.from({ length: CHILD_COUNT }, () =>
          execFileAsync(
            process.execPath,
            [childPath, lockPath, outputPath, markerPath, journalPath],
            {
              env: { ...process.env, RUN_ID: 'the-run-under-test' },
            }
          )
        )
      );

      const journal = readFileSync(journalPath, 'utf8').trim().split('\n');
      const runs = journal.filter((line) => line.startsWith('run '));
      const outcomes = journal.filter((line) => line.startsWith('outcome '));

      // One scan across all three processes, and nobody gave up waiting for it.
      expect(runs).toHaveLength(1);
      expect(outcomes).toHaveLength(CHILD_COUNT);
      expect(outcomes.filter((line) => line.endsWith('ran'))).toHaveLength(CHILD_COUNT);
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
        writtenBy: expect.any(Number),
      });
    },
    TEST_TIMEOUT_MS
  );
});
