import { JsPackageManagerFactory, PackageManagerName } from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProjectInfo } from '../../project-info.ts';
import { frameworkToRendererMap } from '../framework-renderer.ts';
import { DEFAULT_PROMPT_NAME, getSetupMarkdownOutput, PROMPT_NAMES } from './index.ts';

const projectInfo: ProjectInfo = {
  storybookVersion: '10.5.0',
  majorVersion: 10,
  framework: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  renderer: SupportedRenderer.REACT,
  builderPackage: '@storybook/builder-vite',
  addons: [],
  configDir: '.storybook',
  storiesPaths: [],
  language: 'ts',
  packageManager: JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.NPM }),
  packageManagerName: 'npm',
  hasCsfFactoryPreview: false,
  needsUserOnboarding: false,
  monorepoType: undefined,
};

afterEach(() => vi.unstubAllEnvs());

describe.each(['ts', 'js'] as const)('setup instructions in %s projects', (language) => {
  it.each([
    ['@storybook/angular-vite', SupportedRenderer.ANGULAR],
    ['@storybook/angular', SupportedRenderer.ANGULAR],
    ['@storybook/vue3-vite', SupportedRenderer.VUE3],
    ['@storybook/svelte-vite', SupportedRenderer.SVELTE],
    ['@storybook/preact-vite', SupportedRenderer.PREACT],
  ] as const)('keeps all prompts free of React examples for %s', async (framework, renderer) => {
    for (const name of new Set(PROMPT_NAMES)) {
      vi.stubEnv('EVAL_SETUP_PROMPT', name);
      const { markdown, prompt } = await getSetupMarkdownOutput({
        ...projectInfo,
        framework,
        rendererPackage: frameworkToRendererMap[framework],
        renderer,
        language,
      });

      expect(markdown).toContain(framework);
      expect(markdown).toContain(`preview.${language}`);
      expect(markdown).toContain(`*.stories.${language}`);
      expect(markdown).toContain(`renderer=${renderer}`);
      expect(markdown).toContain('return Story();');
      expect(markdown).not.toMatch(
        /\breact\b|jsx|tsx|<Story|SessionProvider|ThemeProvider|createPortal|children:/i
      );
      expect(prompt).toBe(
        ['setup', 'pattern-copy-play'].includes(name) ? DEFAULT_PROMPT_NAME : name
      );
    }
  });

  it.each(['@storybook/react-vite', '@storybook/nextjs-vite'])(
    'preserves React examples for %s',
    async (framework) => {
      for (const name of [
        DEFAULT_PROMPT_NAME,
        'monorepo',
        'relaxed-limits',
        'monorepo-optimized-tests-relaxed-limits-no-story-deletion',
      ]) {
        vi.stubEnv('EVAL_SETUP_PROMPT', name);
        const { markdown } = await getSetupMarkdownOutput({ ...projectInfo, framework, language });

        expect(markdown).toContain(`preview.${language}x`);
        expect(markdown).toContain('<SessionProvider>');
        expect(markdown).toContain('<Story />');
        expect(markdown).toContain("children: 'Order now'");
        expect(markdown).toContain(`main.${language}x`);
        expect(markdown).toContain(`App.${language}x`);
        expect(markdown).toContain('providers wrapping `<App />`');
        expect(markdown).toContain('`useQuery`');
        expect(markdown).toContain('Use the **real** provider tree');
        expect(markdown).toContain("`createPortal(..., document.getElementById('foo'))`");
        expect(markdown).toContain('Copy JSX patterns');
        expect(markdown).toContain('a hex color in styled-components');
        expect(markdown).toContain("args: { children: 'Submit' }");
        expect(markdown).toContain("canvas.getByRole('button', { name: /submit/i })");
      }
    }
  );
});

it.each([false, true])(
  'uses Vue preview syntax with factory preview = %s',
  async (hasCsfFactoryPreview) => {
    vi.stubEnv('EVAL_SETUP_PROMPT', '');
    const { markdown } = await getSetupMarkdownOutput({
      ...projectInfo,
      framework: '@storybook/vue3-vite',
      rendererPackage: '@storybook/vue3',
      renderer: SupportedRenderer.VUE3,
      hasCsfFactoryPreview,
    });

    expect(markdown).toContain(hasCsfFactoryPreview ? 'definePreview({' : 'const preview: Preview');
    expect(markdown).not.toMatch(/react|jsx|tsx|<Story|SessionProvider/i);
  }
);

it('does not assume React when project framework metadata is unavailable', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput({
    ...projectInfo,
    framework: null,
    rendererPackage: null,
    renderer: undefined,
  });

  expect(markdown).toContain('your-framework-package');
  expect(markdown).not.toMatch(/react|jsx|tsx|<Story|SessionProvider/i);
});

it('uses the detected renderer instead of guessing React from a custom framework name', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput({
    ...projectInfo,
    framework: '@custom/framework',
    rendererPackage: '@storybook/vue3',
    renderer: SupportedRenderer.VUE3,
  });

  expect(markdown).toContain('@custom/framework');
  expect(markdown).not.toMatch(/react|jsx|tsx|<Story|SessionProvider/i);
});
