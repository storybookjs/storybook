import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import type { TemplateDetails } from '../task';
import { setupVitest } from './sandbox-parts';

vi.mock('node:fs/promises');
vi.mock('../utils/main-js', { spy: true });
vi.mock('../../code/core/src/csf-tools', { spy: true });
vi.mock('../utils/paths', { spy: true });

const { readFile, writeFile } = await import('node:fs/promises');
const { readConfig } = await import('../utils/main-js');
const { writeConfig } = await import('../../code/core/src/csf-tools');
const { findFirstPath } = await import('../utils/paths');

describe('setupVitest', () => {
  const mockSandboxDir = '/mock/sandbox';
  const mockPackageJson = {
    name: 'test-sandbox',
    version: '1.0.0',
    scripts: {
      dev: 'vite dev',
      build: 'vite build',
    },
  };

  const mockViteConfig = dedent`
    /// <reference types="vitest/config" />
    import { sveltekit } from '@sveltejs/kit/vite';
    import { defineConfig } from 'vite';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';
    import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
    import { playwright } from '@vitest/browser-playwright';
    const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

    // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
    export default defineConfig({
      plugins: [sveltekit()],
      test: {
        projects: [{
          extends: true,
          plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook')
          })],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [{
                browser: 'chromium'
              }]
            },
            setupFiles: ['.storybook/vitest.setup.ts']
          }
        }]
      }
    });
  `;

  const mockTemplateDetails: TemplateDetails = {
    key: 'svelte-kit/skeleton-ts',
    sandboxDir: mockSandboxDir,
    template: {
      name: 'SvelteKit TypeScript',
      expected: {
        framework: '@storybook/sveltekit',
        renderer: '@storybook/svelte',
        builder: '@storybook/builder-vite',
      },
    },
  } as TemplateDetails;

  const mockPreviewConfig = {
    setFieldValue: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock readFile to return different content based on the path
    vi.mocked(readFile).mockImplementation(async (path: any) => {
      const pathStr = path.toString();
      if (pathStr.includes('package.json')) {
        return JSON.stringify(mockPackageJson, null, 2);
      }
      if (pathStr.includes('vite.config.ts')) {
        return mockViteConfig;
      }
      throw new Error(`Unexpected file read: ${pathStr}`);
    });

    // Mock writeFile
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Mock findFirstPath to return vite.config.ts
    vi.mocked(findFirstPath).mockResolvedValue('vite.config.ts');

    // Mock readConfig to return a mock preview config
    vi.mocked(readConfig).mockResolvedValue(mockPreviewConfig as any);

    // Mock writeConfig
    vi.mocked(writeConfig).mockResolvedValue(undefined);
  });

  it('should add vitest script to package.json', async () => {
    await setupVitest(mockTemplateDetails, { link: false });

    // Find the writeFile call for package.json
    const packageJsonWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('package.json'));

    expect(packageJsonWrite).toBeDefined();
    const writtenPackageJson = JSON.parse(packageJsonWrite![1] as string);
    expect(writtenPackageJson.scripts.vitest).toBe(
      'vitest --reporter=default --reporter=hanging-process --test-timeout=5000'
    );
  });

  it('should add vitest addon resolution in link mode', async () => {
    await setupVitest(mockTemplateDetails, { link: true });

    const packageJsonWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('package.json'));

    const writtenPackageJson = JSON.parse(packageJsonWrite![1] as string);
    expect(writtenPackageJson.resolutions).toBeDefined();
    expect(writtenPackageJson.resolutions['@storybook/addon-vitest']).toMatch(/file:/);
  });

  it('should create vitest setup file with correct imports for SvelteKit', async () => {
    await setupVitest(mockTemplateDetails, { link: false });

    const setupFileWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('vitest.setup.ts'));

    expect(setupFileWrite).toBeDefined();
    const setupFileContent = setupFileWrite![1] as string;

    expect(setupFileContent).toContain("import { beforeAll } from 'vitest'");
    expect(setupFileContent).toContain(
      "import { setProjectAnnotations } from '@storybook/sveltekit'"
    );
    expect(setupFileContent).toContain(
      "import * as rendererDocsAnnotations from '@storybook/svelte/entry-preview-docs'"
    );
    expect(setupFileContent).toContain(
      "import * as addonA11yAnnotations from '@storybook/addon-a11y/preview'"
    );
    expect(setupFileContent).toContain("import '../src/stories/components'");
    expect(setupFileContent).toContain(
      "import * as templateAnnotations from '../template-stories/core/preview'"
    );
    expect(setupFileContent).toContain("import * as projectAnnotations from './preview'");
    expect(setupFileContent).toContain('setProjectAnnotations([');
  });

  it('should add preserveSymlinks to vite config', async () => {
    await setupVitest(mockTemplateDetails, { link: false });

    const viteConfigWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('vite.config.ts'));

    expect(viteConfigWrite).toBeDefined();
    const transformedConfig = viteConfigWrite![1] as string;

    expect(transformedConfig).toContain('resolve: {\n    preserveSymlinks: true\n  },');
    // Verify it's added after plugins
    expect(transformedConfig).toMatch(/plugins:\s*\[[^\]]*\],?\s*resolve:\s*\{/);
  });

  it('should add tags to storybookTest config', async () => {
    await setupVitest(mockTemplateDetails, { link: false });

    const viteConfigWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('vite.config.ts'));

    expect(viteConfigWrite).toBeDefined();
    const transformedConfig = viteConfigWrite![1] as string;

    expect(transformedConfig).toContain("tags: {\n    include: ['vitest']\n  }");
    // Verify it's inside storybookTest
    expect(transformedConfig).toMatch(
      /storybookTest\(\{[\s\S]*tags:\s*\{[\s\S]*include:\s*\['vitest'\][\s\S]*\}\s*\}\)/
    );
  });

  it('should produce the expected transformed vite config', async () => {
    await setupVitest(mockTemplateDetails, { link: false });

    const viteConfigWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('vite.config.ts'));

    const transformedConfig = viteConfigWrite![1] as string;

    // The expected transformation:
    // 1. resolve with preserveSymlinks added after plugins
    // 2. tags with include: ['vitest'] added to storybookTest

    const expectedConfig = dedent`
      /// <reference types="vitest/config" />
      import { sveltekit } from '@sveltejs/kit/vite';
      import { defineConfig } from 'vite';
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      import { playwright } from '@vitest/browser-playwright';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      export default defineConfig({
        plugins: [sveltekit()],
        resolve: {
          preserveSymlinks: true
        },
        test: {
          projects: [{
            extends: true,
            plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
              tags: {
                include: ['vitest']
              }
            })],
            test: {
              name: 'storybook',
              browser: {
                enabled: true,
                headless: true,
                provider: playwright({}),
                instances: [{
                  browser: 'chromium'
                }]
              },
              setupFiles: ['.storybook/vitest.setup.ts']
            }
          }]
        }
      });
    `;

    expect(transformedConfig).toBe(expectedConfig);
  });

  it('should set tags in preview config', async () => {
    await setupVitest(mockTemplateDetails, { link: false });

    expect(mockPreviewConfig.setFieldValue).toHaveBeenCalledWith(['tags'], ['vitest']);
    expect(writeConfig).toHaveBeenCalledWith(mockPreviewConfig);
  });

  it('should handle react-vite with CSF4', async () => {
    const reactViteTemplate: TemplateDetails = {
      ...mockTemplateDetails,
      template: {
        ...mockTemplateDetails.template,
        name: 'React Vite TypeScript',
        expected: {
          framework: '@storybook/react-vite',
          renderer: '@storybook/react',
          builder: '@storybook/builder-vite',
        },
      },
    } as TemplateDetails;

    await setupVitest(reactViteTemplate, { link: false });

    const setupFileWrite = vi
      .mocked(writeFile)
      .mock.calls.find((call) => call[0].toString().includes('vitest.setup.ts'));

    expect(setupFileWrite).toBeDefined();
    const setupFileContent = setupFileWrite![1] as string;

    // CSF4 has a simpler setup
    expect(setupFileContent).toContain("import { beforeAll } from 'vitest'");
    expect(setupFileContent).toContain(
      "import { setProjectAnnotations } from '@storybook/react-vite'"
    );
    expect(setupFileContent).toContain("import projectAnnotations from './preview'");
    expect(setupFileContent).toContain('setProjectAnnotations(projectAnnotations.composed)');
    // Should not contain the full array of annotations
    expect(setupFileContent).not.toContain('rendererDocsAnnotations');
  });

  it('should throw error if no vite/vitest config file found', async () => {
    vi.mocked(findFirstPath).mockResolvedValue(null);

    await expect(setupVitest(mockTemplateDetails, { link: false })).rejects.toThrow(
      'No Vitest or Vite config file found in sandbox: /mock/sandbox'
    );
  });
});

