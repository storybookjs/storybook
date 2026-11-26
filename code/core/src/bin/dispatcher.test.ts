import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('../telemetry/detect-agent.ts', { spy: true });
// A version no installed CLI package has, so the dispatcher has to download it.
vi.mock('../common/versions.ts', () => ({
  default: {
    storybook: '0.0.0-test',
    '@storybook/cli': '0.0.0-test',
    'create-storybook': '0.0.0-test',
  },
}));

const packageManager = {
  type: 'yarn2',
  runPackageCommand: vi.fn<JsPackageManager['runPackageCommand']>(),
};

const originalArgv = process.argv;

const callOrders = (mock: unknown) => vi.mocked(mock as () => void).mock.invocationCallOrder;

// The dispatcher runs on import, so every test needs fresh modules, and with them fresh spies.
const freshMocks = async () => {
  const common = await import('storybook/internal/common');
  const { detectAgent } = await import('../telemetry/detect-agent.ts');
  return {
    precheck: vi.mocked(common.runStorybookInstallPrecheck),
    getPackageManager: vi.mocked(common.JsPackageManagerFactory.getPackageManager),
    detectAgent: vi.mocked(detectAgent),
  };
};

const dispatch = async (...args: string[]) => {
  process.argv = ['node', 'storybook', ...args];
  await import('./dispatcher.ts');
  await vi.waitFor(() =>
    expect([
      ...callOrders(packageManager.runPackageCommand),
      ...callOrders(process.exit),
    ]).not.toEqual([])
  );
};

describe('dispatcher', () => {
  let mocks: Awaited<ReturnType<typeof freshMocks>>;

  beforeEach(async () => {
    vi.resetModules();
    mocks = await freshMocks();
    mocks.getPackageManager.mockReturnValue(packageManager as unknown as JsPackageManager);
    mocks.precheck.mockResolvedValue(undefined);
    mocks.detectAgent.mockReturnValue(undefined);
    packageManager.runPackageCommand.mockReturnValue({ on: vi.fn() } as never);
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it.each([
    { command: 'upgrade', pkg: '@storybook/cli', installContext: 'upgrade' },
    { command: 'init', pkg: 'create-storybook', installContext: 'create' },
  ])(
    'prechecks the package age gate before downloading $pkg for $command',
    async ({ command, pkg, installContext }) => {
      await dispatch(command);

      expect(mocks.precheck).toHaveBeenCalledWith(packageManager, {
        storybookVersion: '0.0.0-test',
        installContext,
        yes: false,
      });
      expect(packageManager.runPackageCommand).toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining([`${pkg}@0.0.0-test`]) })
      );
      expect(callOrders(mocks.precheck)[0]).toBeLessThan(
        callOrders(packageManager.runPackageCommand)[0]
      );
    }
  );

  it.each(['--yes', '-y', '-fy'])('prechecks without asking when %s is passed', async (flag) => {
    await dispatch('upgrade', flag);

    expect(mocks.precheck).toHaveBeenCalledWith(
      packageManager,
      expect.objectContaining({ yes: true })
    );
  });

  it('does not read flags from the value of -c', async () => {
    await dispatch('upgrade', '-cnyh');

    expect(mocks.precheck).toHaveBeenCalledWith(
      packageManager,
      expect.objectContaining({ yes: false })
    );
  });

  describe('agent mode', () => {
    it.each([
      { name: 'init --agent', args: ['init', '--agent'], agent: false, yes: true },
      { name: 'init run by an agent', args: ['init'], agent: true, yes: true },
      {
        name: 'init --no-agent run by an agent',
        args: ['init', '--no-agent'],
        agent: true,
        yes: false,
      },
      {
        name: 'init --agent --no-agent',
        args: ['init', '--agent', '--no-agent'],
        agent: false,
        yes: false,
      },
      {
        name: 'init --no-agent --agent',
        args: ['init', '--no-agent', '--agent'],
        agent: false,
        yes: true,
      },
      {
        name: 'upgrade run by an agent, which has no agent mode',
        args: ['upgrade'],
        agent: true,
        yes: false,
      },
    ])('passes yes: $yes for $name', async ({ args, agent, yes }) => {
      mocks.detectAgent.mockReturnValue(agent ? { name: 'claude' } : undefined);

      await dispatch(...args);

      expect(mocks.precheck).toHaveBeenCalledWith(packageManager, expect.objectContaining({ yes }));
    });
  });

  it('exits before the download when the age gate blocks this Storybook version', async () => {
    mocks.precheck.mockRejectedValue(new Error('blocked by the age gate'));

    await dispatch('upgrade');

    expect(process.exit).toHaveBeenCalledWith(1);
    const [exitOrder] = callOrders(process.exit);
    expect(
      callOrders(packageManager.runPackageCommand).filter((order) => order < exitOrder)
    ).toEqual([]);
  });

  it.each([
    ['upgrade', '--dry-run'],
    ['upgrade', '-n'],
    ['upgrade', '-yn'],
    ['upgrade', '-ync.storybook'],
    ['upgrade', '--help'],
    ['upgrade', '-h'],
    ['init', '--help'],
  ])('does not precheck %s %s, because the precheck can write config', async (...args) => {
    await dispatch(...args);

    expect(mocks.precheck).not.toHaveBeenCalled();
  });

  it('does not precheck commands that do not install Storybook packages', async () => {
    await dispatch('doctor');

    expect(mocks.precheck).not.toHaveBeenCalled();
  });
});
