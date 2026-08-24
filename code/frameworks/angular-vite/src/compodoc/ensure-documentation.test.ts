// Real temp directories: the lock and the run marker this orchestrates are real files whose
// cross-process behaviour memfs cannot model. Compodoc itself is mocked out - what is under test
// here is when it runs, not what it produces.
import { logger } from 'storybook/internal/node-logger';

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPODOC_LOCK,
  COMPODOC_RUN_MARKER,
  ensureCompodocDocumentation,
} from './ensure-documentation.ts';
import { generateDocumentation } from './generate-documentation.ts';

vi.mock('./generate-documentation.ts', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

let workspaceRoot: string;
let outputDir: string;

const documentationJson = () => join(outputDir, 'documentation.json');
const lockPath = () => join(outputDir, COMPODOC_LOCK);
const markerPath = () => join(outputDir, COMPODOC_RUN_MARKER);

const options = (overrides: Partial<Parameters<typeof ensureCompodocDocumentation>[0]> = {}) => ({
  compodocArgs: ['-e', 'json', '-d', 'dist/docs'],
  tsconfig: join(workspaceRoot, '.storybook', 'tsconfig.json'),
  workspaceRoot,
  outputDir,
  ...overrides,
});

/** Writes the file a real run would have written, so waiters see the winner's output. */
const writeDocumentation = async () => {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(documentationJson(), '{"components":[]}');
};

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'sb-ensure-compodoc-'));
  outputDir = join(workspaceRoot, 'dist', 'docs');
  vi.stubEnv('STORYBOOK_COMPODOC_RUN_ID', 'run-under-test');
  vi.mocked(generateDocumentation).mockImplementation(writeDocumentation);
});

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('ensureCompodocDocumentation', () => {
  it('generates when nothing has run yet', async () => {
    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).toHaveBeenCalledWith(
      expect.objectContaining({
        compodocArgs: ['-e', 'json', '-d', 'dist/docs'],
        workspaceRoot,
        outputDir,
      })
    );
    expect(readFileSync(markerPath(), 'utf8')).toBe('run-under-test');
  });

  it('regenerates even when documentation.json is already on disk', async () => {
    // The whole point of the change: a file left by an earlier run is not evidence that this run
    // has scanned. Nothing here looks at source timestamps.
    await writeDocumentation();
    vi.mocked(generateDocumentation).mockClear();

    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).toHaveBeenCalledOnce();
  });

  it('regenerates when the marker names an earlier run', async () => {
    await writeDocumentation();
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(markerPath(), 'a-previous-run');
    vi.mocked(generateDocumentation).mockClear();

    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).toHaveBeenCalledOnce();
  });

  it('does nothing when this run already generated', async () => {
    await ensureCompodocDocumentation(options());
    vi.mocked(generateDocumentation).mockClear();

    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).not.toHaveBeenCalled();
  });

  it('scans once for concurrent callers, even starting from an existing documentation.json', async () => {
    // Without the marker re-check inside the lock this is three serialized scans: each waiter
    // acquires in turn and has nothing telling it the work is already done.
    await writeDocumentation();
    vi.mocked(generateDocumentation).mockClear();

    await Promise.all([
      ensureCompodocDocumentation(options()),
      ensureCompodocDocumentation(options()),
      ensureCompodocDocumentation(options()),
    ]);

    expect(generateDocumentation).toHaveBeenCalledOnce();
  });

  it('gives up rather than blocking boot when another process holds the lock too long', async () => {
    // Also pins the lock's location: anywhere but beside the output and this would acquire its own
    // lock and generate instead of waiting.
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(lockPath(), JSON.stringify({ token: 'someone-else', pid: process.pid }));

    await ensureCompodocDocumentation(options({ waitBudgetMs: 100 }));

    expect(generateDocumentation).not.toHaveBeenCalled();
  });

  it('leaves the marker alone when the run fails, so the next caller retries', async () => {
    vi.mocked(generateDocumentation).mockRejectedValue(new Error('compodoc exited with code 1'));

    await expect(ensureCompodocDocumentation(options())).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('compodoc exited with code 1')
    );
    expect(existsSync(markerPath())).toBe(false);
    expect(existsSync(lockPath())).toBe(false);
  });
});
