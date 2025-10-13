import { stat } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportedLanguage } from 'storybook/internal/cli';

import { ConfigGenerationService } from './ConfigGenerationService';

vi.mock('node:fs/promises', { spy: true });

describe('ConfigGenerationService', () => {
  let service: ConfigGenerationService;

  beforeEach(() => {
    service = new ConfigGenerationService();
    vi.clearAllMocks();
  });

  describe('generateMainConfig', () => {
    it('should generate TypeScript main config with framework package', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const config = await service.generateMainConfig({
        addons: ['@storybook/addon-essentials'],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        frameworkPackage: '@storybook/react-vite',
        prefixes: [],
        features: [],
        framework: { name: '@storybook/react-vite', options: {} },
      });

      expect(config).toContain("import type { StorybookConfig } from '@storybook/react-vite'");
      expect(config).toContain('const config: StorybookConfig = {');
      expect(config).toContain('@storybook/addon-essentials');
      expect(config).toContain('../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)');
      expect(config).toContain('export default config');
    });

    it('should generate JavaScript main config', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const config = await service.generateMainConfig({
        addons: ['@storybook/addon-essentials'],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.JAVASCRIPT,
        frameworkPackage: '@storybook/vue3-vite',
        prefixes: [],
        features: [],
        framework: { name: '@storybook/vue3-vite', options: {} },
      });

      expect(config).toContain("/** @type { import('@storybook/vue3-vite').StorybookConfig } */");
      expect(config).toContain('const config = {');
      expect(config).not.toContain(': StorybookConfig');
    });

    it('should include docs stories when docs feature is enabled', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const config = await service.generateMainConfig({
        addons: [],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        prefixes: [],
        features: ['docs'],
      });

      expect(config).toContain('../stories/**/*.mdx');
      expect(config).toContain('../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)');
    });

    it('should use src directory when it exists', async () => {
      vi.mocked(stat).mockResolvedValue({} as any);

      const config = await service.generateMainConfig({
        addons: [],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        prefixes: [],
        features: [],
      });

      expect(config).toContain('../src/**/*.stories.@(js|jsx|mjs|ts|tsx)');
    });

    it('should include custom extensions', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const config = await service.generateMainConfig({
        addons: [],
        extensions: ['js', 'ts', 'svelte'],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        prefixes: [],
        features: [],
      });

      expect(config).toContain('../stories/**/*.stories.@(js|ts|svelte)');
    });

    it('should include prefixes in the output', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const prefixes = ['import { dirname } from "path"', 'import { fileURLToPath } from "url"'];

      const config = await service.generateMainConfig({
        addons: [],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        frameworkPackage: '@storybook/react-vite',
        prefixes,
        features: [],
      });

      expect(config).toContain('import { dirname } from "path"');
      expect(config).toContain('import { fileURLToPath } from "url"');
    });

    it('should handle custom properties', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const config = await service.generateMainConfig({
        addons: [],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        prefixes: [],
        features: [],
        framework: { name: '@storybook/react-vite' },
        core: { builder: '@storybook/builder-vite' },
      });

      expect(config).toContain('"framework"');
      expect(config).toContain('"core"');
    });

    it('should add path import when framework uses path.dirname', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const config = await service.generateMainConfig({
        addons: [],
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        frameworkPackage: '@storybook/react-vite',
        prefixes: [],
        features: [],
        framework: { name: 'path.dirname(fileURLToPath(...))' },
      });

      expect(config).toContain("import path from 'node:path'");
    });
  });

  describe('getMainConfigPath', () => {
    it('should return TypeScript path for TypeScript language', () => {
      const path = service.getMainConfigPath('.storybook', SupportedLanguage.TYPESCRIPT);
      expect(path).toBe('./.storybook/main.ts');
    });

    it('should return JavaScript path for JavaScript language', () => {
      const path = service.getMainConfigPath('.storybook', SupportedLanguage.JAVASCRIPT);
      expect(path).toBe('./.storybook/main.js');
    });
  });

  describe('generatePreviewConfig', () => {
    it('should generate TypeScript preview config', () => {
      const config = service.generatePreviewConfig({
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        frameworkPackage: '@storybook/react-vite',
      });

      expect(config).toContain("import type { Preview } from '@storybook/react-vite'");
      expect(config).toContain('const preview: Preview = {');
      expect(config).toContain('color: /(background|color)$/i');
      expect(config).toContain('date: /Date$/i');
      expect(config).toContain('export default preview');
    });

    it('should generate JavaScript preview config', () => {
      const config = service.generatePreviewConfig({
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.JAVASCRIPT,
        frameworkPackage: '@storybook/vue3-vite',
      });

      expect(config).toContain("/** @type { import('@storybook/vue3-vite').Preview } */");
      expect(config).toContain('const preview = {');
      expect(config).not.toContain(': Preview');
    });

    it('should include framework preview parts prefix', () => {
      const config = service.generatePreviewConfig({
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
        frameworkPackage: '@storybook/angular',
        frameworkPreviewParts: {
          prefix: "import { setCompodocJson } from '@storybook/addon-docs/angular';",
        },
      });

      expect(config).toContain("import { setCompodocJson } from '@storybook/addon-docs/angular'");
    });

    it('should handle missing framework package in TypeScript', () => {
      const config = service.generatePreviewConfig({
        storybookConfigFolder: '.storybook',
        language: SupportedLanguage.TYPESCRIPT,
      });

      expect(config).not.toContain('import type { Preview }');
      // TypeScript still generates type annotation without import
      expect(config).toContain('const preview');
    });
  });

  describe('getPreviewConfigPath', () => {
    it('should return TypeScript path for TypeScript language', () => {
      const path = service.getPreviewConfigPath('.storybook', SupportedLanguage.TYPESCRIPT);
      expect(path).toBe('./.storybook/preview.ts');
    });

    it('should return JavaScript path for JavaScript language', () => {
      const path = service.getPreviewConfigPath('.storybook', SupportedLanguage.JAVASCRIPT);
      expect(path).toBe('./.storybook/preview.js');
    });
  });

  describe('previewExists', () => {
    it('should return true when preview file exists', async () => {
      vi.mocked(stat).mockResolvedValue({} as any);

      const exists = await service.previewExists('.storybook', SupportedLanguage.TYPESCRIPT);

      expect(exists).toBe(true);
    });

    it('should return false when preview file does not exist', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('not found'));

      const exists = await service.previewExists('.storybook', SupportedLanguage.JAVASCRIPT);

      expect(exists).toBe(false);
    });
  });
});
