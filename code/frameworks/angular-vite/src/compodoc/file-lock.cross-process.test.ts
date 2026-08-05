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
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { withFileLock } from ${JSON.stringify(lockModule)};

const [lockPath, outputPath, journalPath] = process.argv.slice(2);

const outcome = await withFileLock(lockPath, async () => {
  if (existsSync(outputPath)) {
    return;
  }
  appendFileSync(journalPath, \`run \${process.pid}\\n\`);
  await new Promise((resolve) => setTimeout(resolve, ${CRITICAL_SECTION_MS}));
  writeFileSync(outputPath, JSON.stringify({ writtenBy: process.pid }));
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
