import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import type { UpgradeOptions } from './upgrade.ts';
import { getProjects } from './util.ts';

let root: string;

const createFixture = (files: Record<string, string>) => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'storybook-find-projects-')));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
};

describe('getProjects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('asks for --config-dir instead of prompting when --yes finds no .storybook directory', async () => {
    createFixture({ 'storybook/main.ts': 'export default {};' });
    vi.spyOn(process, 'cwd').mockReturnValue(root);

    await expect(getProjects({ yes: true } as UpgradeOptions)).rejects.toThrow('--config-dir');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('--config-dir'));
  });
});
