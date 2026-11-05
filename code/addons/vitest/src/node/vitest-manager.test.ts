import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVitest } from 'vitest/node';

import { getProjectRoot } from 'storybook/internal/common';

import { join } from 'pathe';

import type { TestManager } from './test-manager.ts';
import { VitestManager } from './vitest-manager.ts';

vi.mock('vitest/node', () => ({ createVitest: vi.fn(), version: '5.0.5' }));
vi.mock('storybook/internal/common', { spy: true });

let workspaceRoot: string;
let packageRoot: string;
let manager: VitestManager;

beforeEach(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), 'storybook-vitest-workspace-'));
  packageRoot = join(workspaceRoot, 'packages', 'web');
  await mkdir(join(packageRoot, '.storybook'), { recursive: true });
  await writeFile(join(packageRoot, 'package.json'), '{}');
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

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('Vitest config discovery', () => {
  it.each(['directory', 'file'])(
    'finds a workspace config above the overridden Storybook root with a .git %s',
    async (gitEntry) => {
      if (gitEntry === 'directory') {
        await mkdir(join(workspaceRoot, '.git'));
      } else {
        await writeFile(join(workspaceRoot, '.git'), 'gitdir: /repo/.git/worktrees/web');
      }
      await writeFile(
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
      await mkdir(join(workspaceRoot, '.git'));
      await writeFile(
        join(workspaceRoot, workspaceConfig),
        'export default { plugins: [storybookTest()] }'
      );
      await writeFile(
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
    await mkdir(join(workspaceRoot, '.git'));
    await writeFile(join(workspaceRoot, 'vitest.config.mts'), 'export default {}');
    await writeFile(join(packageRoot, 'vitest.config.ts'), 'export default {}');

    await manager.startVitest({ coverage: false });

    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ root: packageRoot })
    );
  });

  it('does not search above the Git repository root', async () => {
    await mkdir(join(packageRoot, '.git'));
    await writeFile(
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
    await writeFile(
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
