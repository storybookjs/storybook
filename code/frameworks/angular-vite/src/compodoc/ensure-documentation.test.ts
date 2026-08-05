// Real temp directories: the lock this orchestrates is a real file whose exclusion memfs cannot
// model, and freshness is decided from real mtimes. Compodoc itself is mocked out - what is under
// test here is when it runs, not what it produces.
import { logger } from 'storybook/internal/node-logger';

import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPODOC_LOCK,
  ensureCompodocDocumentation,
  newestSourceMtimeMs,
} from './ensure-documentation.ts';
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

const write = (relativePath: string, mtimeMs?: number) => {
  const path = join(workspaceRoot, relativePath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
  if (mtimeMs !== undefined) {
    at(path, mtimeMs);
  }
  return path;
};

const options = (overrides: Partial<Parameters<typeof ensureCompodocDocumentation>[0]> = {}) => ({
  compodocArgs: ['-e', 'json', '-d', 'dist/docs'],
  // Deliberately inside `.storybook`, matching the tsconfig Storybook's own Angular template ships.
  // The scan must still reach `src/`, which is where every component lives.
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
  write('package.json');
  write('.storybook/tsconfig.json');
  write('src/button.component.ts', Date.now() - 60_000);
  vi.mocked(generateDocumentation).mockImplementation(writeDocumentation);
});

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('newestSourceMtimeMs', () => {
  it('counts the sources Compodoc reads and ignores the ones it excludes', () => {
    // Mirrors Compodoc's own INCLUDE_PATTERNS/EXCLUDE_PATTERNS. Counting `.d.ts` or `.spec.ts` would
    // force a rescan after an ordinary build or test edit; missing `.tsx` would leave a new component
    // undocumented until something else changed.
    write('src/widget.component.tsx', 6000);
    write('src/button.component.html', 9000);
    write('src/button.component.spec.ts', 9000);
    write('src/generated.d.ts', 9000);
    at(componentPath(), 1000);

    expect(newestSourceMtimeMs(workspaceRoot)).toBe(6000);
  });

  it('skips build output, which is regenerated constantly and never read by Compodoc', () => {
    at(componentPath(), 1000);
    write('node_modules/some-package/index.ts', 9000);
    write('dist/lib.ts', 9000);
    write('.angular/cache/thing.ts', 9000);

    expect(newestSourceMtimeMs(workspaceRoot)).toBe(1000);
  });
});

describe('ensureCompodocDocumentation', () => {
  it('runs Compodoc and awaits it when there is no documentation.json yet', async () => {
    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).toHaveBeenCalledWith(
      expect.objectContaining({
        compodocArgs: ['-e', 'json', '-d', 'dist/docs'],
        workspaceRoot,
        outputDir,
      })
    );
  });

  it('serves an up-to-date file from disk instead of re-running Compodoc', async () => {
    await writeDocumentation();
    vi.mocked(generateDocumentation).mockClear();

    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).not.toHaveBeenCalled();
  });

  it('re-runs when a source under the workspace has been touched since the file was written', async () => {
    // Also pins the scan root: a check rooted at the tsconfig's own directory would only see
    // `.storybook`, never notice this edit, and serve stale metadata forever.
    await writeDocumentation();
    at(documentationJson(), Date.now() - 60_000);
    at(componentPath(), Date.now());
    vi.mocked(generateDocumentation).mockClear();

    await ensureCompodocDocumentation(options());

    expect(generateDocumentation).toHaveBeenCalledOnce();
  });

  it('runs once for concurrent callers, and hands the rest the same result', async () => {
    await Promise.all([
      ensureCompodocDocumentation(options()),
      ensureCompodocDocumentation(options()),
      ensureCompodocDocumentation(options()),
    ]);

    expect(generateDocumentation).toHaveBeenCalledOnce();
    expect(existsSync(documentationJson())).toBe(true);
  });

  it('gives up rather than blocking boot when another process holds the lock too long', async () => {
    // Also pins the lock's location: anywhere but beside the output and this would acquire its own
    // lock and generate instead of waiting.
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(lockPath(), JSON.stringify({ token: 'someone-else', pid: process.pid }));

    await ensureCompodocDocumentation(options({ waitBudgetMs: 100 }));

    expect(generateDocumentation).not.toHaveBeenCalled();
  });

  it('reports a failed run instead of breaking docgen construction', async () => {
    vi.mocked(generateDocumentation).mockRejectedValue(new Error('compodoc exited with code 1'));

    await expect(ensureCompodocDocumentation(options())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('compodoc exited with code 1')
    );
    expect(existsSync(lockPath())).toBe(false);
  });
});
