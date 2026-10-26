import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../initiate.ts', { spy: true });

describe('create-storybook CLI', () => {
  let createStorybookProgram: typeof import('./run.ts').createStorybookProgram;
  let initiate: typeof import('../initiate.ts').initiate;

  beforeEach(async () => {
    vi.resetModules();
    ({ createStorybookProgram } = await import('./run.ts'));
    ({ initiate } = await import('../initiate.ts'));
    vi.mocked(initiate).mockResolvedValue(undefined);
  });

  it.each([
    { flag: undefined, skipInstall: false },
    { flag: '--no-install', skipInstall: true },
    { flag: '--install', skipInstall: false },
    { flag: '--skip-install', skipInstall: true },
  ])('forwards $flag as skipInstall=$skipInstall', async ({ flag, skipInstall }) => {
    await createStorybookProgram.parseAsync(['node', 'create-storybook', ...(flag ? [flag] : [])]);

    expect(initiate).toHaveBeenCalledWith(expect.objectContaining({ skipInstall }));
  });
});
