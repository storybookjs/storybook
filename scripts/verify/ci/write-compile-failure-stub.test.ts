import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeCompileFailureStub } from './write-compile-failure-stub.ts';

describe('writeCompileFailureStub', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'verify-stub-test-'));
  });
  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes a regression verdict with last-4KB ANSI-stripped details', async () => {
    const log = join(workDir, 'compile.log');
    const ansi = '\x1b[31merror\x1b[0m: build failed';
    // 4500-byte log so the tailing kicks in.
    const padding = 'x'.repeat(4500);
    writeFileSync(log, padding + '\n' + ansi, 'utf-8');

    const outDir = join(workDir, 'out');
    const resultJson = await writeCompileFailureStub({
      log,
      outDir,
      template: 'internal-ui',
    });

    const parsed = JSON.parse(readFileSync(resultJson, 'utf-8'));
    expect(parsed.verdict).toBe('regression');
    expect(parsed.regressionReason).toMatch(/compile failure/);
    expect(parsed.template).toBe('internal-ui');
    expect(parsed.regressionDetails).toContain('error: build failed');
    // ANSI escape sequences should be stripped.
    expect(parsed.regressionDetails).not.toContain('\x1b[');
    // Tail bound: <= 4000 chars retained.
    expect(parsed.regressionDetails.length).toBeLessThanOrEqual(4000);
  });

  it('still writes a stub when the log file is missing', async () => {
    const outDir = join(workDir, 'out-missing');
    const resultJson = await writeCompileFailureStub({
      log: join(workDir, 'does-not-exist.log'),
      outDir,
    });
    const parsed = JSON.parse(readFileSync(resultJson, 'utf-8'));
    expect(parsed.verdict).toBe('regression');
    expect(parsed.regressionReason).toMatch(/compile failure/);
  });
});
