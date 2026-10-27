import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import { resolve } from 'node:path';

import * as find from 'empathic/find';

import { findTsconfigUp, resolveTsconfig } from './find-tsconfig.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('empathic/find', { spy: true });

const WORKSPACE_ROOT = resolve('/workspace');
const CONFIG_DIR = resolve('/workspace/projects/lib/.storybook');

beforeEach(() => {
  vi.mocked(getProjectRoot).mockReturnValue(WORKSPACE_ROOT);
  vi.mocked(find.up).mockReturnValue(undefined);
});

describe('findTsconfigUp', () => {
  it('walks up from the config dir, bounded by the project root', () => {
    const found = resolve(WORKSPACE_ROOT, 'projects/lib/tsconfig.json');
    vi.mocked(find.up).mockReturnValue(found);

    expect(findTsconfigUp(CONFIG_DIR)).toBe(found);
    expect(find.up).toHaveBeenCalledWith('tsconfig.json', {
      cwd: CONFIG_DIR,
      last: WORKSPACE_ROOT,
    });
  });

  it('returns undefined when the walk finds nothing', () => {
    expect(findTsconfigUp(CONFIG_DIR)).toBeUndefined();
  });
});

describe('resolveTsconfig', () => {
  it('resolves a workspace-relative `tsConfig` against the workspace root', () => {
    const result = resolveTsconfig({
      workspaceRoot: WORKSPACE_ROOT,
      configDir: CONFIG_DIR,
      tsConfig: 'projects/lib/.storybook/tsconfig.json',
    });

    expect(result).toBe(resolve(WORKSPACE_ROOT, 'projects/lib/.storybook/tsconfig.json'));
  });

  it('leaves an absolute `tsConfig` untouched', () => {
    const absolute = resolve('/elsewhere/tsconfig.json');

    const result = resolveTsconfig({
      workspaceRoot: WORKSPACE_ROOT,
      configDir: CONFIG_DIR,
      tsConfig: absolute,
    });

    expect(result).toBe(absolute);
  });

  it('falls back to the nearest tsconfig above the config dir', () => {
    const found = resolve(WORKSPACE_ROOT, 'projects/lib/.storybook/tsconfig.json');
    vi.mocked(find.up).mockReturnValue(found);

    const result = resolveTsconfig({ workspaceRoot: WORKSPACE_ROOT, configDir: CONFIG_DIR });

    expect(result).toBe(found);
  });

  it('falls back to the browser target tsConfig, also workspace-relative', () => {
    const result = resolveTsconfig({
      workspaceRoot: WORKSPACE_ROOT,
      configDir: CONFIG_DIR,
      browserTsConfig: 'projects/lib/tsconfig.app.json',
    });

    expect(result).toBe(resolve(WORKSPACE_ROOT, 'projects/lib/tsconfig.app.json'));
  });

  it('prefers an explicit `tsConfig` over both fallbacks', () => {
    vi.mocked(find.up).mockReturnValue(resolve(WORKSPACE_ROOT, 'walked/tsconfig.json'));

    const result = resolveTsconfig({
      workspaceRoot: WORKSPACE_ROOT,
      configDir: CONFIG_DIR,
      tsConfig: 'explicit/tsconfig.json',
      browserTsConfig: 'browser/tsconfig.app.json',
    });

    expect(result).toBe(resolve(WORKSPACE_ROOT, 'explicit/tsconfig.json'));
  });

  it('returns undefined when no tsconfig can be found', () => {
    const result = resolveTsconfig({ workspaceRoot: WORKSPACE_ROOT, configDir: CONFIG_DIR });

    expect(result).toBeUndefined();
  });
});
