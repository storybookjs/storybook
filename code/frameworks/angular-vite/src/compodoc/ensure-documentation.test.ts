// Real temp directories: the lock this orchestrates is a real file whose exclusion memfs cannot
// model, and freshness is decided from real mtimes. Compodoc itself is mocked out - what is under
// test here is when it runs, not what it produces.
import { logger } from 'storybook/internal/node-logger';

import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMPODOC_LOCK, ensureCompodocDocumentation } from './ensure-documentation.ts';
import { generateDocumentation } from './generate-documentation.ts';

vi.mock('./generate-documentation.ts', { spy: true });
vi.mock('storybook/internal/node-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

let workspaceRoot: string;
let outputDir: string;

const componentPath = () => join(workspaceRoot, 'src', 'button.component.ts');
const documentationJson = () => join(outputDir, 'documentation.json');
const lockPath = () => join(outputDir, COMPODOC_LOCK);

const at = (path: string, ms: number) => utimesSync(path, new Date(ms), new Date(ms));

const options = (overrides: Partial<Parameters<typeof ensureCompodocDocumentation>[0]> = {}) => ({
  compodocArgs: ['-e', 'json', '-d', 'dist/docs'],
  tsconfig: join(workspaceRoot, 'tsconfig.json'),
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
  mkdirSync(join(workspaceRoot, 'src'), { recursive: true });
  writeFileSync(join(workspaceRoot, 'package.json'), '{}');
  writeFileSync(join(workspaceRoot, 'tsconfig.json'), '{}');
  writeFileSync(componentPath(), 'export class ButtonComponent {}');
  at(componentPath(), Date.now() - 60_000);
  vi.mocked(generateDocumentation).mockImplementation(writeDocumentation);
});

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('ensureCompodocDocumentation', () => {
  it('runs Compodoc and awaits it when there is no documentation.json yet', async () => {
    await expect(ensureCompodocDocumentation(options())).resolves.toBe('generated');

    expect(generateDocumentation).toHaveBeenCalledWith(
      expect.objectContaining({
        compodocArgs: ['-e', 'json', '-d', 'dist/docs'],
        workspaceRoot,
        outputDir,
      })
    );
    expect(existsSync(documentationJson())).toBe(true);
  });

  it('serves an up-to-date file from disk instead of re-running Compodoc', async () => {
    await writeDocumentation();
    vi.mocked(generateDocumentation).mockClear();

    await expect(ensureCompodocDocumentation(options())).resolves.toBe('fresh');
    expect(generateDocumentation).not.toHaveBeenCalled();
  });

  it('re-runs when a source file has been touched since the file was written', async () => {
    await writeDocumentation();
    at(documentationJson(), Date.now() - 60_000);
    at(componentPath(), Date.now());
    vi.mocked(generateDocumentation).mockClear();

    await expect(ensureCompodocDocumentation(options())).resolves.toBe('generated');
    expect(generateDocumentation).toHaveBeenCalledOnce();
  });

  it('runs once for concurrent callers, and hands the rest the same result', async () => {
    const outcomes = await Promise.all([
      ensureCompodocDocumentation(options()),
      ensureCompodocDocumentation(options()),
      ensureCompodocDocumentation(options()),
    ]);

    expect(generateDocumentation).toHaveBeenCalledOnce();
    expect(outcomes.filter((outcome) => outcome === 'generated')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === 'generated-elsewhere')).toHaveLength(2);
    expect(existsSync(documentationJson())).toBe(true);
  });

  it('takes the lock beside the output, so a redirected -d directory is still honoured', async () => {
    let lockHeldDuringRun: boolean | undefined;
    vi.mocked(generateDocumentation).mockImplementation(async () => {
      lockHeldDuringRun = existsSync(lockPath());
      await writeDocumentation();
    });

    await expect(ensureCompodocDocumentation(options())).resolves.toBe('generated');

    expect(lockHeldDuringRun).toBe(true);
    expect(existsSync(lockPath())).toBe(false);
  });

  it('gives up rather than blocking boot when another process holds the lock too long', async () => {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(lockPath(), JSON.stringify({ pid: process.pid, createdAt: Date.now() }));

    await expect(ensureCompodocDocumentation(options({ waitBudgetMs: 100 }))).resolves.toBe(
      'timed-out'
    );
    expect(generateDocumentation).not.toHaveBeenCalled();
  });

  it('reports a failed run instead of breaking docgen construction', async () => {
    vi.mocked(generateDocumentation).mockRejectedValue(new Error('compodoc exited with code 1'));

    await expect(ensureCompodocDocumentation(options())).resolves.toBe('failed');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('compodoc exited with code 1')
    );
    expect(existsSync(lockPath())).toBe(false);
  });
});
