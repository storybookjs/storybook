import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type JsPackageManager,
  PackageManagerName,
  recordReactDocgenFallback,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { DependencyCollector } from '../dependency-collector.ts';
import type { CommandOptions } from '../generators/types.ts';
import type { TelemetryService } from '../services/TelemetryService.ts';
import { TypeScriptDependencyCommand } from './TypeScriptDependencyCommand.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const packageManagerWith = (
  typescriptVersion?: string,
  reactDocgenInstalled = false,
  packageJson: Record<string, unknown> = {}
) =>
  ({
    isDependencyInstalled: (name: string) =>
      (name === 'typescript' && !!typescriptVersion) ||
      (name === 'react-docgen' && reactDocgenInstalled),
    getDeclaredVersionSpecifier: async () => typescriptVersion ?? null,
    primaryPackageJson: { packageJson, operationDir: '/project' },
  }) as unknown as JsPackageManager;

const run = async ({
  options = {},
  framework = SupportedFramework.REACT_VITE,
  renderer = SupportedRenderer.REACT,
  typescriptVersion,
  reactDocgenInstalled = false,
  interactive = true,
  packageJson,
}: {
  options?: Partial<CommandOptions>;
  framework?: SupportedFramework | null;
  renderer?: SupportedRenderer;
  typescriptVersion?: string;
  reactDocgenInstalled?: boolean;
  interactive?: boolean;
  packageJson?: Record<string, unknown>;
} = {}) => {
  const telemetryService = {
    trackTypeScriptDependency: vi.fn(),
    trackPromptCancel: vi.fn(),
  } as unknown as TelemetryService;
  const dependencyCollector = new DependencyCollector();
  const packageManager = packageManagerWith(typescriptVersion, reactDocgenInstalled, packageJson);
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
    dependencies: dependencyCollector.getAllPackages().dependencies,
    devDependencies: dependencyCollector.getAllPackages().devDependencies,
    telemetryService,
    packageManager,
  };
};

beforeEach(() => {
  vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'true');
  vi.mocked(prompt.confirm).mockResolvedValue(true);
  vi.mocked(recordReactDocgenFallback).mockImplementation(() => {});
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.info).mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
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

  it('asks, then upgrades a React project from TypeScript 7.0 to 7.1', async () => {
    const { result, devDependencies } = await run({ typescriptVersion: '~7.0.2' });

    expect(prompt.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('typescript@^7.1') }),
      expect.anything()
    );
    expect(result).toBe('upgraded');
    expect(devDependencies).toEqual(['typescript@^7.1']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('upgrades a typescript the project declares in dependencies there', async () => {
    const { dependencies, devDependencies } = await run({
      typescriptVersion: '~7.0.2',
      packageJson: { dependencies: { typescript: '~7.0.2' } },
    });

    expect(dependencies).toEqual(['typescript@^7.1']);
    expect(devDependencies).toEqual([]);
  });

  it('upgrades without asking when the terminal is not interactive', async () => {
    const { result } = await run({ typescriptVersion: '7.0.2', interactive: false });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe('upgraded');
  });

  describe('when the user declines the TypeScript 7.1 upgrade', () => {
    beforeEach(() => {
      vi.mocked(prompt.confirm).mockResolvedValue(false);
    });

    it('tells a React project on TypeScript 7.0 to upgrade to 7.1', async () => {
      const { result, devDependencies } = await run({ typescriptVersion: '7.0.2' });

      expect(result).toBe('without-compiler-api');
      expect(devDependencies).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('typescript@^7.1'));
    });

    it('says that docgen falls back to the react-docgen a React project on TypeScript 7.0 has', async () => {
      const { devDependencies } = await run({
        typescriptVersion: '7.0.2',
        reactDocgenInstalled: true,
      });

      expect(devDependencies).toEqual([]);
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('falls back to the deprecated builder docgen with `react-docgen`')
      );
    });

    it('does not add react-docgen to a React project on TypeScript 7.0', async () => {
      const { devDependencies } = await run({ typescriptVersion: '7.0.2' });

      expect(devDependencies).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Controls and the Docs args table show no props')
      );
    });
  });

  it('follows --no-install-typescript for the upgrade', async () => {
    const { result } = await run({
      typescriptVersion: '7.0.2',
      options: { installTypescript: false },
    });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe('without-compiler-api');
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

  it('does not mention builder docgen to a Vue project on TypeScript 7', async () => {
    await run({
      typescriptVersion: '7.0.2',
      framework: SupportedFramework.VUE3_VITE,
      renderer: SupportedRenderer.VUE3,
    });

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(expect.not.stringContaining('builder docgen'));
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

  it('does nothing for a native-only React Native project, which has no docgen', async () => {
    const { result, devDependencies } = await run({ framework: null, options: { yes: true } });

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(result).toBe('not-needed');
    expect(devDependencies).toEqual([]);
  });

  describe('before TypeScript 7.1 is stable', () => {
    beforeEach(() => {
      vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'false');
    });

    it('adds typescript@^6 to a React project without TypeScript', async () => {
      const { devDependencies } = await run();

      expect(devDependencies).toEqual(['typescript@^6']);
    });

    it('adds react-docgen to a React project on TypeScript 7.0 and records it as temporary', async () => {
      const { result, devDependencies } = await run({ typescriptVersion: '7.0.2' });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result).toBe('without-compiler-api');
      expect(devDependencies).toEqual(['react-docgen@^8.0.2']);
      expect(recordReactDocgenFallback).toHaveBeenCalledExactlyOnceWith('/project');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('"typescript": "npm:@typescript/typescript6@^6.0.2"')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('falls back to the deprecated builder docgen with `react-docgen`')
      );
    });

    it('leaves a react-docgen the project already declares alone', async () => {
      const { devDependencies } = await run({
        typescriptVersion: '7.0.2',
        reactDocgenInstalled: true,
      });

      expect(devDependencies).toEqual([]);
      expect(recordReactDocgenFallback).not.toHaveBeenCalled();
    });
  });
});
