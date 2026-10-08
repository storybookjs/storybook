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
    ['@storybook/angular-vite', SupportedRenderer.ANGULAR, 'angular'],
    ['@storybook/angular', SupportedRenderer.ANGULAR, 'angular'],
    ['@storybook/vue3-vite', SupportedRenderer.VUE3, 'vue'],
    ['@storybook/svelte-vite', SupportedRenderer.SVELTE, 'svelte'],
    ['@storybook/preact-vite', SupportedRenderer.PREACT, 'preact'],
  ] as const)(
    'keeps all prompts free of React examples for %s',
    async (framework, renderer, docsRenderer) => {
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
        expect(markdown).toContain(`renderer=${docsRenderer}&`);
        expect(markdown).not.toMatch(
          /\breact\b|jsx|tsx|<Story|SessionProvider|ThemeProvider|createPortal|children:/i
        );
        expect(prompt).toBe(
          ['setup', 'pattern-copy-play'].includes(name) ? DEFAULT_PROMPT_NAME : name
        );
      }
    }
  );

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
        expect(markdown).toContain('`createPortal(...)`');
        expect(markdown).toContain('JSX patterns copied');
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

it('keeps MSW and MockDate optional and installs them separately', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput(projectInfo);

  expect(markdown).toContain('If a selected story makes network requests');
  expect(markdown).toContain("If a selected story's output depends on the current date or time");
  expect(markdown).toContain('Otherwise skip this step');
  expect(markdown).not.toMatch(/npm install[^\n]*msw[^\n]*mockdate/i);
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

it('keeps the default prompt under 11 KB, so agents read it in one go', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput(projectInfo);

  expect(Buffer.byteLength(markdown)).toBeLessThan(11_000);
});

it.each([...new Set(PROMPT_NAMES)])(
  'names no agent-specific tools in the %s prompt',
  async (name) => {
    vi.stubEnv('EVAL_SETUP_PROMPT', name);
    const { markdown } = await getSetupMarkdownOutput(projectInfo);

    expect(markdown).not.toMatch(/\b(Glob|Grep)\b/);
  }
);

it.each([...new Set(PROMPT_NAMES)])(
  'links an existing Vitest docs page in the %s prompt',
  async (name) => {
    vi.stubEnv('EVAL_SETUP_PROMPT', name);
    const { markdown } = await getSetupMarkdownOutput(projectInfo);

    expect(markdown).not.toContain('writing-tests/vitest-plugin');
  }
);

it('lets npm projects use npx', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput(projectInfo);

  expect(markdown).toContain('**Use npm** for installs and `npx storybook`');
  expect(markdown).not.toMatch(/(don't|do not) use `npx`/i);
});

it('keeps pnpm projects off npx', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput({
    ...projectInfo,
    packageManager: JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.PNPM }),
    packageManagerName: 'pnpm',
  });

  expect(markdown).toContain('**Use pnpm** for installs and `pnpm exec storybook`');
  expect(markdown).toContain("Don't use `npx`");
  expect(markdown).toContain('pnpm exec vitest --project storybook run');
});

it('has the agent add the Vitest addon only when the project lacks it', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const without = await getSetupMarkdownOutput(projectInfo);
  const withAddon = await getSetupMarkdownOutput({
    ...projectInfo,
    addons: ['@storybook/addon-vitest'],
  });

  expect(without.markdown).toContain('npx storybook add @storybook/addon-vitest --yes');
  expect(withAddon.markdown).not.toContain('storybook add @storybook/addon-vitest');
});

it('only lets the agent delete the examples that storybook init generated', async () => {
  vi.stubEnv('EVAL_SETUP_PROMPT', '');
  const { markdown } = await getSetupMarkdownOutput(projectInfo);

  expect(markdown).toContain('Never delete or rewrite the stories, components, or config');
  expect(markdown).toContain('delete that folder once your own stories pass');
});
