import { existsSync, readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVitest } from 'vitest/node';

import { getProjectRoot } from 'storybook/internal/common';

import { fs, vol } from 'memfs';
import { join, resolve } from 'pathe';

import type { TestManager } from './test-manager.ts';
import { VitestManager } from './vitest-manager.ts';

vi.mock('node:fs', { spy: true });
vi.mock('vitest/node', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const workspaceRoot = resolve('/workspace');
const packageRoot = join(workspaceRoot, 'packages', 'web');
let manager: VitestManager;

beforeEach(() => {
  vol.reset();
  fs.mkdirSync(join(packageRoot, '.storybook'), { recursive: true });
  fs.writeFileSync(join(packageRoot, 'package.json'), '{}');
  vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(fs.readFileSync as typeof readFileSync);
  vi.mocked(getProjectRoot).mockReturnValue(packageRoot);
  vi.mocked(createVitest).mockResolvedValue({
    standalone: vi.fn(),
    onCancel: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof createVitest>>);
  manager = new VitestManager({
    storybookOptions: { configDir: join(packageRoot, '.storybook') },
  } as TestManager);
  vi.spyOn(manager, 'setupWatchers').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vol.reset();
});

describe('Vitest config discovery', () => {
  it.each(['directory', 'file'])(
    'finds a workspace config above the overridden Storybook root with a .git %s',
    async (gitEntry) => {
      if (gitEntry === 'directory') {
        fs.mkdirSync(join(workspaceRoot, '.git'));
      } else {
        fs.writeFileSync(join(workspaceRoot, '.git'), 'gitdir: /repo/.git/worktrees/web');
      }
      fs.writeFileSync(
        join(workspaceRoot, 'vitest.config.ts'),
        'export default { plugins: [storybookTest()] }'
      );

      await manager.startVitest({ coverage: false });

      expect(createVitest).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ root: workspaceRoot })
      );
    }
  );

  it.each(['vitest.config.ts', 'vitest.config.mts', 'vite.config.mts'])(
    'prefers a package config over workspace %s',
    async (workspaceConfig) => {
      fs.mkdirSync(join(workspaceRoot, '.git'));
      fs.writeFileSync(
        join(workspaceRoot, workspaceConfig),
        'export default { plugins: [storybookTest()] }'
      );
      fs.writeFileSync(
        join(packageRoot, 'vitest.config.ts'),
        'export default { plugins: [storybookTest()] }'
      );

      await manager.startVitest({ coverage: false });

      expect(createVitest).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ root: packageRoot })
      );
    }
  );

  it('uses the nearest config as the fallback across file extensions', async () => {
    fs.mkdirSync(join(workspaceRoot, '.git'));
    fs.writeFileSync(join(workspaceRoot, 'vitest.config.mts'), 'export default {}');
    fs.writeFileSync(join(packageRoot, 'vitest.config.ts'), 'export default {}');

    await manager.startVitest({ coverage: false });

    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ root: packageRoot })
    );
  });

  it('finds the workspace config when a submodule has a nearer .git file', async () => {
    vi.mocked(getProjectRoot).mockReturnValue(workspaceRoot);
    fs.mkdirSync(join(workspaceRoot, '.git'));
    fs.writeFileSync(join(packageRoot, '.git'), 'gitdir: ../../.git/modules/packages/web');
    fs.writeFileSync(
      join(workspaceRoot, 'vitest.config.ts'),
      'export default { plugins: [storybookTest()] }'
    );

    await manager.startVitest({ coverage: false });

    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ root: workspaceRoot })
    );
  });

  it('prefers a workspace Storybook config over a plain package Vite config', async () => {
    fs.mkdirSync(join(workspaceRoot, '.git'));
    fs.writeFileSync(join(packageRoot, 'vite.config.ts'), 'export default {}');
    fs.writeFileSync(
      join(workspaceRoot, 'vitest.config.ts'),
      'export default { plugins: [storybookTest()] }'
    );

    await manager.startVitest({ coverage: false });

    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ root: workspaceRoot })
    );
  });

  it('does not search above the Git repository root', async () => {
    fs.mkdirSync(join(packageRoot, '.git'));
    fs.writeFileSync(
      join(workspaceRoot, 'vitest.config.ts'),
      'export default { plugins: [storybookTest()] }'
    );

    await manager.startVitest({ coverage: false });

    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ root: packageRoot })
    );
  });

  it('keeps the Storybook project root as the search boundary outside a Git repository', async () => {
    fs.writeFileSync(
      join(workspaceRoot, 'vitest.config.ts'),
      'export default { plugins: [storybookTest()] }'
    );

    await manager.startVitest({ coverage: false });

    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ root: packageRoot })
    );
  });
});
