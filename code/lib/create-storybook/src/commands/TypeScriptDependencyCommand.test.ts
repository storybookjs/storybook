import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { SupportedRenderer } from 'storybook/internal/types';

import { DependencyCollector } from '../dependency-collector.ts';
import type { CommandOptions } from '../generators/types.ts';
import type { TelemetryService } from '../services/TelemetryService.ts';
import { TypeScriptDependencyCommand } from './TypeScriptDependencyCommand.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const packageManagerWith = (typescriptVersion?: string) =>
  ({
    isDependencyInstalled: (name: string) => name === 'typescript' && !!typescriptVersion,
    getDeclaredVersionSpecifier: async () => typescriptVersion ?? null,
  }) as unknown as JsPackageManager;

const run = async ({
  options = {},
  renderer = SupportedRenderer.REACT,
  typescriptVersion,
  interactive = true,
}: {
  options?: Partial<CommandOptions>;
  renderer?: SupportedRenderer;
  typescriptVersion?: string;
  interactive?: boolean;
} = {}) => {
  const telemetryService = {
    trackTypeScriptDependency: vi.fn(),
    trackPromptCancel: vi.fn(),
  } as unknown as TelemetryService;
  const dependencyCollector = new DependencyCollector();
  const result = await new TypeScriptDependencyCommand(
    { packageManager: PackageManagerName.NPM, ...options },
    telemetryService,
    () => interactive
  ).execute({
    packageManager: packageManagerWith(typescriptVersion),
    renderer,
    dependencyCollector,
  });
  return {
    result,
    devDependencies: dependencyCollector.getAllPackages().devDependencies,
    telemetryService,
  };
};

beforeEach(() => {
  vi.mocked(prompt.confirm).mockResolvedValue(true);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.info).mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TypeScriptDependencyCommand', () => {
  it('asks, then adds typescript@^7.1 to a React project without TypeScript', async () => {
    const { result, devDependencies, telemetryService } = await run();

    expect(prompt.confirm).toHaveBeenCalledOnce();
    expect(result).toBe('added');
    expect(devDependencies).toEqual(['typescript@^7.1']);
    expect(telemetryService.trackTypeScriptDependency).toHaveBeenCalledWith('added');
  });

  it.each([SupportedRenderer.VUE3, SupportedRenderer.SVELTE, SupportedRenderer.WEB_COMPONENTS])(
    'adds typescript@^6 to a %s project, whose docgen needs the compiler API',
    async (renderer) => {
      const { result, devDependencies } = await run({ renderer });

      expect(result).toBe('added');
      expect(devDependencies).toEqual(['typescript@^6']);
    }
  );

  describe('when the user declines', () => {
    beforeEach(() => {
      vi.mocked(prompt.confirm).mockResolvedValue(false);
    });

    it('adds nothing', async () => {
      const { result, devDependencies } = await run();

      expect(result).toBe('declined');
      expect(devDependencies).toEqual([]);
    });
  });

  it.each([
    ['--install-typescript', { installTypescript: true }, 'added'],
    ['--no-install-typescript', { installTypescript: false }, 'declined'],
    ['--no-install-typescript with --yes', { installTypescript: false, yes: true }, 'declined'],
    ['--yes', { yes: true }, 'added'],
  ] as const)('follows %s without asking', async (_flag, options, expected) => {
    const { result } = await run({ options });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('adds TypeScript without asking when the terminal is not interactive', async () => {
    const { result } = await run({ interactive: false });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe('added');
  });

  it('follows --no-install-typescript when the terminal is not interactive', async () => {
    const { result } = await run({ interactive: false, options: { installTypescript: false } });

    expect(result).toBe('declined');
  });

  it('leaves a project on TypeScript 6 alone', async () => {
    const { result, devDependencies } = await run({ typescriptVersion: '6.0.3' });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe('already-installed');
    expect(devDependencies).toEqual([]);
  });

  it('leaves a React project on TypeScript 7.1 alone', async () => {
    const { result, devDependencies } = await run({ typescriptVersion: '7.1.0' });

    expect(result).toBe('already-installed');
    expect(devDependencies).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('tells a React project on TypeScript 7.0 to upgrade to 7.1', async () => {
    const { result, devDependencies } = await run({ typescriptVersion: '7.0.2' });

    expect(result).toBe('without-compiler-api');
    expect(devDependencies).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('typescript@^7.1'));
  });

  it('warns a Vue project on TypeScript 7 with the side-by-side setup', async () => {
    const { result, devDependencies } = await run({
      renderer: SupportedRenderer.VUE3,
      typescriptVersion: '7.0.2',
    });

    expect(result).toBe('without-compiler-api');
    expect(devDependencies).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"typescript": "npm:@typescript/typescript6@^6.0.2"')
    );
  });

  it('warns when the project declares TypeScript 7 but has not installed it yet', async () => {
    const { result } = await run({ renderer: SupportedRenderer.VUE3, typescriptVersion: '^7.0.2' });

    expect(result).toBe('without-compiler-api');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('npm:typescript@^7.0.2'));
  });

  it.each([SupportedRenderer.PREACT, SupportedRenderer.HTML, SupportedRenderer.ANGULAR])(
    'does nothing for %s, which has no TypeScript docgen peer',
    async (renderer) => {
      const { result, devDependencies, telemetryService } = await run({ renderer });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result).toBe('not-needed');
      expect(devDependencies).toEqual([]);
      expect(telemetryService.trackTypeScriptDependency).not.toHaveBeenCalled();
    }
  );
});
