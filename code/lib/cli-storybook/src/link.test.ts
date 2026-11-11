import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { sync as spawnSync } from 'cross-spawn';

import { isYarnBerryVersion, link } from './link.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('cross-spawn', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ name: '@storybook/code' }) as never);
  vi.mocked(writeFile).mockResolvedValue();
  vi.mocked(executeCommand).mockResolvedValue({} as never);
  vi.mocked(logger.warn).mockImplementation(() => {});
});

describe('isYarnBerryVersion', () => {
  it('accepts Yarn 2 and newer, including prereleases', () => {
    expect(isYarnBerryVersion('2.4.3')).toBe(true);
    expect(isYarnBerryVersion('4.18.1\n')).toBe(true);
    expect(isYarnBerryVersion('6.0.0-rc.23')).toBe(true);
    expect(isYarnBerryVersion('10.1.0')).toBe(true);
  });

  it('rejects Yarn Classic and unreadable versions', () => {
    expect(isYarnBerryVersion('1.22.22')).toBe(false);
    expect(isYarnBerryVersion('')).toBe(false);
  });
});

describe('link', () => {
  it.each([
    ['a pnpm project, where corepack refuses to run Yarn', ''],
    ['a Yarn 1 project', '1.22.22\n'],
  ])('explains in one warning why it cannot link %s', async (_, yarnVersion) => {
    vi.mocked(spawnSync).mockReturnValue({ stdout: Buffer.from(yarnVersion) } as never);

    await link({ target: 'repro', local: true, start: false });

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatchInlineSnapshot(`
      "🚨 Expected yarn 2 or higher in repro!
      \`storybook link\` only links Yarn 2+ projects, so it cannot link a pnpm or npm project, such as a reproduction created with \`storybook sandbox\`.
      To link a Yarn 1 project, run \`yarn set version berry\` in 'repro', then link it with the '--local' flag."
    `);
    expect(writeFile).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
