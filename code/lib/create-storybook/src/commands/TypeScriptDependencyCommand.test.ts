import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { DependencyCollector } from '../dependency-collector.ts';
import type { CommandOptions } from '../generators/types.ts';
import type { TelemetryService } from '../services/TelemetryService.ts';
import { TypeScriptDependencyCommand } from './TypeScriptDependencyCommand.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const packageManagerWith = (typescriptVersion?: string) =>
  ({
    isDependencyInstalled: (name: string) => name === 'typescript' && !!typescriptVersion,
    getDeclaredVersionSpecifier: async () => typescriptVersion ?? null,
    primaryPackageJson: { packageJson: {}, operationDir: '/project' },
    writePackageJson: vi.fn(),
  }) as unknown as JsPackageManager;

const run = async ({
  options = {},
  framework = SupportedFramework.REACT_VITE,
  renderer = SupportedRenderer.REACT,
  typescriptVersion,
  interactive = true,
}: {
  options?: Partial<CommandOptions>;
  framework?: SupportedFramework | null;
  renderer?: SupportedRenderer;
  typescriptVersion?: string;
  interactive?: boolean;
} = {}) => {
  const telemetryService = {
    trackTypeScriptDependency: vi.fn(),
    trackPromptCancel: vi.fn(),
  } as unknown as TelemetryService;
  const dependencyCollector = new DependencyCollector();
  const packageManager = packageManagerWith(typescriptVersion);
  const result = await new TypeScriptDependencyCommand(
    { packageManager: PackageManagerName.NPM, ...options },
    telemetryService,
    () => interactive
  ).execute({
    packageManager,
    framework,
    renderer,
    dependencyCollector,
  });
  return {
    result,
    devDependencies: dependencyCollector.getAllPackages().devDependencies,
    telemetryService,
    packageManager,
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
  it('asks, then adds typescript@^6 to a project without TypeScript', async () => {
    const { result, devDependencies, telemetryService } = await run();

    expect(prompt.confirm).toHaveBeenCalledOnce();
    expect(result).toBe('added');
    expect(devDependencies).toEqual(['typescript@^6']);
    expect(telemetryService.trackTypeScriptDependency).toHaveBeenCalledWith('added');
  });

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

  it('warns with the side-by-side setup when the project is on TypeScript 7', async () => {
    const { result } = await run({ typescriptVersion: '7.0.2' });

    expect(result).toBe('without-compiler-api');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"typescript": "npm:@typescript/typescript6@^6.0.2"')
    );
  });

  // TEMPORARY until Storybook supports TypeScript 7.1: see `typescript-7-react-docgen-fallback.ts`.
  it('adds react-docgen to a React project on TypeScript 7 and records it as temporary', async () => {
    const { devDependencies, packageManager } = await run({ typescriptVersion: '7.0.2' });

    expect(devDependencies).toEqual(['react-docgen@^8.0.2']);
    expect(packageManager.primaryPackageJson.packageJson).toEqual({
      storybook: { temporaryDependencies: ['react-docgen'] },
    });
    expect(packageManager.writePackageJson).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('falls back to the deprecated builder docgen with `react-docgen`')
    );
  });

  it('does not mention builder docgen to a Vue project on TypeScript 7', async () => {
    const { devDependencies } = await run({
      typescriptVersion: '7.0.2',
      framework: SupportedFramework.VUE3_VITE,
      renderer: SupportedRenderer.VUE3,
    });

    expect(devDependencies).toEqual([]);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(expect.not.stringContaining('builder docgen'));
  });

  it('warns when the project declares TypeScript 7 but has not installed it yet', async () => {
    const { result } = await run({ typescriptVersion: '^7.0.2' });

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

  it('does nothing for a native-only React Native project, which has no docgen', async () => {
    const { result, devDependencies } = await run({ framework: null, options: { yes: true } });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe('not-needed');
    expect(devDependencies).toEqual([]);
  });
});
