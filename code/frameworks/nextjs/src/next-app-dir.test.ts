import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import { resolveNextAppDir } from './next-app-dir.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getProjectRoot: vi.fn(),
}));

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'sb-nextjs-app-dir-'));
  vi.mocked(getProjectRoot).mockReturnValue(projectRoot);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectRoot, { recursive: true, force: true });
});

describe('resolveNextAppDir', () => {
  it('uses the directory of nextConfigPath', () => {
    expect(resolveNextAppDir(join(projectRoot, 'apps', 'web', 'next.config.ts'))).toBe(
      join(projectRoot, 'apps', 'web')
    );
  });

  it.each(['js', 'mjs', 'cjs', 'ts', 'mts'])(
    'finds the nearest next.config.%s above the working directory',
    async (extension) => {
      const appDir = join(projectRoot, 'apps', 'web');
      await mkdir(join(appDir, 'src'), { recursive: true });
      await writeFile(join(appDir, `next.config.${extension}`), '');
      vi.spyOn(process, 'cwd').mockReturnValue(join(appDir, 'src'));

      expect(resolveNextAppDir()).toBe(appDir);
    }
  );

  it('finds next.config at the project root', async () => {
    await mkdir(join(projectRoot, 'src'));
    await writeFile(join(projectRoot, 'next.config.js'), '');
    vi.spyOn(process, 'cwd').mockReturnValue(join(projectRoot, 'src'));

    expect(resolveNextAppDir()).toBe(projectRoot);
  });

  it('falls back to the project root without a next.config', async () => {
    await mkdir(join(projectRoot, 'apps', 'web'), { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(join(projectRoot, 'apps', 'web'));

    expect(resolveNextAppDir()).toBe(projectRoot);
  });

  it('does not search above the project root', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'sb-nextjs-outside-'));
    await writeFile(join(outside, 'next.config.js'), '');
    const nestedRoot = join(outside, 'repo');
    await mkdir(nestedRoot);
    vi.mocked(getProjectRoot).mockReturnValue(nestedRoot);
    vi.spyOn(process, 'cwd').mockReturnValue(nestedRoot);

    try {
      expect(resolveNextAppDir()).toBe(nestedRoot);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
