import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

// Keep runCompodoc's real implementation available (the output-dir helper is
// still exercised) while recording whether the guard actually invokes it.
const { runCompodoc } = vi.hoisted(() => ({ runCompodoc: vi.fn() }));

vi.mock('vite', () => ({
  mergeConfig: (base: Record<string, unknown>, override: Record<string, unknown>) => ({
    ...base,
    ...override,
  }),
  normalizePath: (p: string) => p,
}));
vi.mock('@analogjs/vite-plugin-angular', () => ({ default: (): unknown[] => [] }));
vi.mock('node:fs', { spy: true });
vi.mock('./builders/utils/run-compodoc.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./builders/utils/run-compodoc.ts')>()),
  runCompodoc,
}));
// The preset's `angularOptionsPlugin` looks up the preview file on disk and
// the mock-reapply plugin reads its mocks from config; none of that runs
// during `viteFinal`, so stub these imports (which would otherwise need the
// `storybook` package to be built) to keep the test hermetic.
vi.mock('storybook/internal/common', () => ({
  findConfigFile: (): string | undefined => undefined,
}));
vi.mock('storybook/internal/mocking-utils', () => ({
  babelParser: {},
  extractMockCalls: (): unknown[] => [],
  findMockRedirect: (): string | undefined => undefined,
  getAutomockCode: (): Record<string, unknown> => ({}),
  getRealPath: (p: string) => p,
}));

import { existsSync } from 'node:fs';

import { viteFinal } from './preset.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';

const WORKSPACE_ROOT = '/workspace';
const CUSTOM_OUTPUT_DIR = 'libs/storybook-host/';

const customDocumentationJson = resolve(
  WORKSPACE_ROOT,
  'libs/storybook-host',
  'documentation.json'
);
const rootDocumentationJson = resolve(WORKSPACE_ROOT, 'documentation.json');
const longFormDocumentationJson = resolve(WORKSPACE_ROOT, 'docs', 'documentation.json');

// Shared filesystem state: each test seeds the paths that "exist" on disk.
let existingFiles: string[];

function makeOptions(frameworkOptions: Record<string, unknown>): StandaloneOptions {
  return {
    presets: {
      apply: async (name: string) => (name === 'framework' ? { options: frameworkOptions } : {}),
    },
    angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT },
  } as unknown as StandaloneOptions;
}

describe('viteFinal compodoc skip-check', () => {
  beforeEach(() => {
    existingFiles = [];
    vi.mocked(existsSync).mockReset();
    vi.mocked(existsSync).mockImplementation((p) => existingFiles.includes(String(p)));
    vi.mocked(runCompodoc).mockReset();
    vi.mocked(runCompodoc).mockResolvedValue(undefined);
  });

  it('runs compodoc when no documentation.json exists anywhere', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, makeOptions({ compodoc: true }));

    expect(runCompodoc).toHaveBeenCalledTimes(1);
  });

  it('skips compodoc when documentation.json exists in the default output directory', async () => {
    existingFiles = [rootDocumentationJson];

    await viteFinal({ root: WORKSPACE_ROOT }, makeOptions({ compodoc: true }));

    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('checks the -d output location rather than the workspace root', async () => {
    // The custom output dir is populated, but the workspace root is not.
    existingFiles = [customDocumentationJson];

    await viteFinal(
      { root: WORKSPACE_ROOT },
      makeOptions({ compodoc: true, compodocArgs: ['-e', 'json', '-d', CUSTOM_OUTPUT_DIR] })
    );

    expect(existsSync).toHaveBeenCalledWith(customDocumentationJson);
    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('runs compodoc when only a stray root documentation.json exists', async () => {
    // A stale file at the workspace root must not suppress regeneration when
    // the real output lives in the configured -d directory.
    existingFiles = [rootDocumentationJson];

    await viteFinal(
      { root: WORKSPACE_ROOT },
      makeOptions({ compodoc: true, compodocArgs: ['-e', 'json', '-d', CUSTOM_OUTPUT_DIR] })
    );

    expect(runCompodoc).toHaveBeenCalledTimes(1);
  });

  it('respects the long-form --output flag when locating documentation.json', async () => {
    existingFiles = [longFormDocumentationJson];

    await viteFinal(
      { root: WORKSPACE_ROOT },
      makeOptions({ compodoc: true, compodocArgs: ['-e', 'json', '--output', 'docs'] })
    );

    expect(existsSync).toHaveBeenCalledWith(longFormDocumentationJson);
    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('does not run compodoc when framework.options.compodoc is false', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, makeOptions({ compodoc: false }));

    expect(runCompodoc).not.toHaveBeenCalled();
  });
});
