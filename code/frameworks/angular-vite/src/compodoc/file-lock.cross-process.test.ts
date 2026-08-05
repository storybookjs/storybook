/**
 * Regression test for the cold-start race: several OS processes reaching "no documentation.json,
 * run Compodoc" at the same instant, which is what `storybook dev`, the Vitest addon's child and a
 * standalone `vitest` run do. Without a lock all of them run a whole-project scan; with it, one
 * does and the rest take its output.
 *
 * Two deliberate deviations from the repo's testing norms, both forced by what is under test:
 *
 * - **memfs cannot be used.** It is a per-process virtual filesystem, so every child would get its
 *   own empty one and exclusion would be vacuously true. Real temp directories are the only way to
 *   give the children a filesystem they genuinely share, following the precedent already checked in
 *   at `core/src/core-server/utils/runtime-instance-registry.test.ts`.
 * - **Real child processes.** The lock's whole point is that it works where module scope does not
 *   reach, so an in-process test would pass while proving nothing about the failure it exists for.
 *
 * What this does not prove: only the interleavings that actually happened. A passing run is evidence
 * the lock holds under the overlap the scheduler produced, not a proof that it holds under all of
 * them. Compodoc is not spawned here either - the critical section is a stand-in, so the test stays
 * fast and does not depend on Compodoc being installed.
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
const CRITICAL_SECTION_MS = 300;
// Generous on purpose: a Windows CI agent starting three Node processes is slow, and a tight budget
// would turn scheduler noise into a failing test.
const TEST_TIMEOUT_MS = 60_000;

const lockModule = join(dirname(fileURLToPath(import.meta.url)), 'file-lock.ts');

/**
 * One "Storybook process": takes the lock, and only generates if the output is not there yet -
 * exactly the shape `ensureCompodocDocumentation` uses. Every run it does appends a line, so the
 * parent can count how many actually happened.
 */
const childSource = `
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { withFileLock } from ${JSON.stringify(lockModule)};

const [lockPath, outputPath, journalPath] = process.argv.slice(2);

const outcome = await withFileLock(
  lockPath,
  {
    shouldRun: () => !existsSync(outputPath),
    run: async () => {
      appendFileSync(journalPath, \`run \${process.pid}\\n\`);
      await new Promise((resolve) => setTimeout(resolve, ${CRITICAL_SECTION_MS}));
      writeFileSync(outputPath, JSON.stringify({ writtenBy: process.pid }));
    },
  },
  { pollIntervalMs: 20 }
);

appendFileSync(journalPath, \`outcome \${process.pid} \${outcome.status}\\n\`);
`;

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sb-compodoc-lock-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('cross-process Compodoc lock', () => {
  it(
    'runs the work in exactly one process and gives every other process the result',
    async () => {
      const childPath = join(workDir, 'child.mts');
      const lockPath = join(workDir, '.compodoc.lock');
      const outputPath = join(workDir, 'documentation.json');
      const journalPath = join(workDir, 'journal.log');
      writeFileSync(childPath, childSource);
      writeFileSync(journalPath, '');

      await Promise.all(
        Array.from({ length: CHILD_COUNT }, () =>
          execFileAsync(process.execPath, [childPath, lockPath, outputPath, journalPath])
        )
      );

      const journal = readFileSync(journalPath, 'utf8').trim().split('\n');
      const runs = journal.filter((line) => line.startsWith('run '));
      const outcomes = journal.filter((line) => line.startsWith('outcome '));

      expect(runs).toHaveLength(1);
      expect(outcomes).toHaveLength(CHILD_COUNT);
      // Nobody hit the wait budget, so every process that did not run took the winner's output.
      expect(outcomes.filter((line) => line.endsWith('skipped'))).toHaveLength(CHILD_COUNT - 1);
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
        writtenBy: expect.any(Number),
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    'without the lock the same three processes all run, which is the failure being regressed',
    async () => {
      const childPath = join(workDir, 'unlocked-child.mts');
      const outputPath = join(workDir, 'documentation.json');
      const journalPath = join(workDir, 'journal.log');
      // The sequence angular-vite shipped before this story: probe, then generate.
      writeFileSync(
        childPath,
        `
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const [outputPath, journalPath] = process.argv.slice(2);
if (!existsSync(outputPath)) {
  appendFileSync(journalPath, \`run \${process.pid}\\n\`);
  await new Promise((resolve) => setTimeout(resolve, ${CRITICAL_SECTION_MS}));
  writeFileSync(outputPath, JSON.stringify({ writtenBy: process.pid }));
}
`
      );
      writeFileSync(journalPath, '');

      await Promise.all(
        Array.from({ length: CHILD_COUNT }, () =>
          execFileAsync(process.execPath, [childPath, outputPath, journalPath])
        )
      );

      const runs = readFileSync(journalPath, 'utf8')
        .trim()
        .split('\n')
        .filter((line) => line.startsWith('run '));

      expect(runs).toHaveLength(CHILD_COUNT);
    },
    TEST_TIMEOUT_MS
  );
});
