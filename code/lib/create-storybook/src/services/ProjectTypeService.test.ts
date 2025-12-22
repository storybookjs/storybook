import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { NxProjectDetectedError } from 'storybook/internal/server-errors';

import type { CommandOptions } from '../generators/types';
import { ProjectTypeService } from './ProjectTypeService';

describe('ProjectTypeService', () => {
  let pm: JsPackageManager;

  beforeEach(() => {
    pm = {
      getAllDependencies: vi.fn(() => ({}) as any),
      getModulePackageJSON: vi.fn(async () => ({ version: '0.0.0' })) as any,
      primaryPackageJson: { packageJson: {} as any },
    } as unknown as JsPackageManager;
    vi.spyOn(logger, 'error').mockImplementation(() => undefined as any);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('autoDetectProjectType', () => {
    it('logs a helpful message when framework cannot be detected', async () => {
      const service = new ProjectTypeService(pm);
      const options = { html: false } as unknown as CommandOptions;
      // @ts-expect-error accessing private for test
      vi.spyOn(service, 'detectProjectType').mockResolvedValue(ProjectType.UNDETECTED);

      await expect(service.autoDetectProjectType(options)).rejects.toThrowError(
        'Storybook failed to detect your project type'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unable to initialize Storybook in this directory.')
      );
    });

    it('throws NxProjectDetectedError when NX project is detected', async () => {
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(true);
      await expect(service.autoDetectProjectType({} as CommandOptions)).rejects.toBeInstanceOf(
        NxProjectDetectedError
      );
    });

    it('returns HTML when options.html is true', async () => {
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: true } as CommandOptions);
      expect(result).toBe(ProjectType.HTML);
    });

    it('detects framework from package.json (nextjs)', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { next: '^13.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.NEXTJS);
    });

    it('detects VUE3 when vue major is 3', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { vue: '^3.2.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.VUE3);
    });

    it('detects SVELTEKIT via @sveltejs/kit', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { '@sveltejs/kit': '^2.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.SVELTEKIT);
    });

    it('detects WEB_COMPONENTS via lit', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { lit: '^3.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.WEB_COMPONENTS);
    });

    it('detects SOLID via solid-js', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { 'solid-js': '^1.8.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.SOLID);
    });

    it('detects REACT_SCRIPTS via dependency', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { 'react-scripts': '^5.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.REACT_SCRIPTS);
    });

    it('detects ANGULAR via @angular/core', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { '@angular/core': '^17.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.ANGULAR);
    });

    it('detects PREACT via preact', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { preact: '^10.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.PREACT);
    });

    it('detects EMBER via ember-cli', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { 'ember-cli': '^5.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.EMBER);
    });

    it('detects QWIK via @builder.io/qwik', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { '@builder.io/qwik': '^1.4.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.QWIK);
    });

    it('detects SVELTE via svelte', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { svelte: '^4.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.SVELTE);
    });

    it('detects REACT_NATIVE via react-native-scripts', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { 'react-native-scripts': '^5.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.REACT_NATIVE);
    });

    it('detects NUXT via nuxt', async () => {
      (pm as any).primaryPackageJson.packageJson = {
        dependencies: { nuxt: '^3.0.0' },
      };
      const service = new ProjectTypeService(pm);
      // @ts-expect-error private method spy
      vi.spyOn(service, 'isNxProject').mockReturnValue(false);
      const result = await service.autoDetectProjectType({ html: false } as CommandOptions);
      expect(result).toBe(ProjectType.NUXT);
    });
  });

  describe('validateProvidedType', () => {
    it('accepts installable types and rejects invalid ones', async () => {
      const service = new ProjectTypeService(pm);
      await expect(service.validateProvidedType(ProjectType.REACT)).resolves.toBe(
        ProjectType.REACT
      );
      await expect(service.validateProvidedType(ProjectType.UNSUPPORTED)).rejects.toThrow(
        /Unknown project type supplied/
      );
    });
  });

  describe('detectLanguage', () => {
    // Note: FS-based language detection (jsconfig/tsconfig) is not tested here to avoid
    // mutating the real filesystem or mocking ESM builtin modules. Covered by TS tooling path.
    it('returns typescript when TS and compatible tooling are present', async () => {
      (pm.getAllDependencies as any) = vi.fn(() => ({ typescript: '^5.0.0' }));
      (pm.getModulePackageJSON as any) = vi.fn(async (name: string) => {
        const versions: Record<string, string> = {
          typescript: '5.2.0',
          prettier: '3.3.0',
          '@babel/plugin-transform-typescript': '7.23.0',
          '@typescript-eslint/parser': '6.7.0',
          'eslint-plugin-storybook': '0.7.0',
        };
        return { version: versions[name] } as any;
      });
      const service = new ProjectTypeService(pm);
      await expect(service.detectLanguage()).resolves.toBe('typescript');
    });

    it('warns and returns javascript when TS/tooling versions incompatible', async () => {
      (pm.getAllDependencies as any) = vi.fn(() => ({ typescript: '^4.8.0' }));
      (pm.getModulePackageJSON as any) = vi.fn(async (name: string) => {
        const versions: Record<string, string> = {
          typescript: '4.8.4',
          prettier: '2.7.1', // below 2.8.0
          '@babel/plugin-transform-typescript': '7.19.0',
          '@typescript-eslint/parser': '5.43.0',
          'eslint-plugin-storybook': '0.6.7',
        };
        return { version: versions[name] } as any;
      });
      const warnSpy = vi.spyOn(logger, 'warn');
      const service = new ProjectTypeService(pm);
      await expect(service.detectLanguage()).resolves.toBe('javascript');
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
