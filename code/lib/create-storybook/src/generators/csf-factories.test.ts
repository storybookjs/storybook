import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SupportedFramework } from 'storybook/internal/types';

import { vol } from 'memfs';
import ts from 'typescript';

import {
  previewImportFromStory,
  rewriteCopiedStoryPreviewImports,
  supportsCsfFactories,
} from './csf-factories.ts';

vi.mock('node:fs/promises', { spy: true });

const repoCode = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('supportsCsfFactories', () => {
  it.each([
    [SupportedFramework.REACT_VITE, true],
    [SupportedFramework.REACT_WEBPACK5, true],
    [SupportedFramework.REACT_NATIVE_WEB_VITE, true],
    [SupportedFramework.NEXTJS, true],
    [SupportedFramework.NEXTJS_VITE, true],
    [SupportedFramework.TANSTACK_REACT, true],
    [SupportedFramework.VUE3_VITE, true],
    [SupportedFramework.SVELTE_VITE, true],
    [SupportedFramework.SVELTEKIT, true],
    [SupportedFramework.ANGULAR, true],
    [SupportedFramework.ANGULAR_VITE, true],
    [SupportedFramework.WEB_COMPONENTS_VITE, true],
    [SupportedFramework.REACT_RSBUILD, true],
    [SupportedFramework.VUE3_RSBUILD, true],
    [SupportedFramework.WEB_COMPONENTS_RSBUILD, true],
    [SupportedFramework.ASTRO, true],
    [SupportedFramework.PREACT_VITE, false],
    [SupportedFramework.HTML_VITE, false],
    [SupportedFramework.EMBER, false],
    [SupportedFramework.SERVER_WEBPACK5, false],
    [SupportedFramework.NUXT, false],
    [SupportedFramework.SOLID, false],
    [SupportedFramework.QWIK, false],
    [SupportedFramework.HTML_RSBUILD, false],
  ] as const)('%s => %s', (framework, expected) => {
    expect(supportsCsfFactories(framework)).toBe(expected);
  });

  it('classifies every SupportedFramework', () => {
    for (const framework of Object.values(SupportedFramework)) {
      expect(typeof supportsCsfFactories(framework)).toBe('boolean');
    }
  });
});

describe('previewImportFromStory', () => {
  it('returns ../../.storybook/preview from src/stories', () => {
    expect(
      previewImportFromStory(
        '/project/src/stories/Button.stories.ts',
        '/project/.storybook/preview.ts'
      )
    ).toBe('../../.storybook/preview');
  });

  it('returns ../.storybook/preview from stories/', () => {
    expect(
      previewImportFromStory('/project/stories/Button.stories.ts', '/project/.storybook/preview.ts')
    ).toBe('../.storybook/preview');
  });
});

describe('rewriteCopiedStoryPreviewImports', () => {
  beforeEach(async () => {
    vol.reset();

    const fsp = await import('node:fs/promises');
    const memfs = await import('memfs');
    vi.mocked(fsp.readdir).mockImplementation(memfs.fs.promises.readdir as typeof fsp.readdir);
    vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as typeof fsp.readFile);
    vi.mocked(fsp.writeFile).mockImplementation(
      memfs.fs.promises.writeFile as typeof fsp.writeFile
    );
  });

  it('rewrites the template preview import when stories land outside src/', async () => {
    vol.fromNestedJSON({
      '/project/stories': {
        'Button.stories.ts':
          "import preview from '../../.storybook/preview';\nconst meta = preview.meta({});\n",
        'Button.tsx': 'export const Button = () => null;',
      },
    });

    await rewriteCopiedStoryPreviewImports({
      destination: '/project/stories',
      previewConfigPath: '/project/.storybook/preview.ts',
    });

    expect(vol.toJSON()['/project/stories/Button.stories.ts']).toContain(
      "import preview from '../.storybook/preview'"
    );
    expect(vol.toJSON()['/project/stories/Button.tsx']).toBe('export const Button = () => null;');
  });

  it('leaves the src/stories import alone', async () => {
    const source =
      "import preview from '../../.storybook/preview';\nconst meta = preview.meta({});\n";
    vol.fromNestedJSON({
      '/project/src/stories': {
        'Button.stories.ts': source,
      },
    });

    await rewriteCopiedStoryPreviewImports({
      destination: '/project/src/stories',
      previewConfigPath: '/project/.storybook/preview.ts',
    });

    expect(vol.toJSON()['/project/src/stories/Button.stories.ts']).toBe(source);
  });

  it('does nothing when the destination is missing', async () => {
    await rewriteCopiedStoryPreviewImports({
      destination: '/missing/stories',
      previewConfigPath: '/project/.storybook/preview.ts',
    });

    expect(vol.toJSON()).toEqual({});
  });
});

describe('native CLI templates', () => {
  it.each([
    ['renderers/svelte/template/cli/ts/Button.stories.svelte', true],
    ['renderers/react/template/cli/ts/Button.stories.tsx', true],
    ['renderers/vue3/template/cli/ts/Button.stories.ts', true],
    ['renderers/web-components/template/cli/ts/Button.stories.ts', true],
    ['frameworks/react-vite/template/cli/ts/Button.stories.tsx', true],
    ['frameworks/angular/template/cli/button.stories.ts', true],
    ['frameworks/sveltekit/template/cli/ts/Button.stories.svelte', true],
    ['renderers/preact/template/cli/Button.stories.jsx', false],
    ['renderers/html/template/cli/ts/Button.stories.ts', false],
    ['frameworks/ember/template/cli/Button.stories.js', false],
  ] as const)('%s', (relativePath, csf4) => {
    const source = readFileSync(join(repoCode, relativePath), 'utf8');
    if (csf4) {
      expect(source).toContain('.meta(');
      expect(source).toContain('../../.storybook/preview');
      expect(source).not.toContain('export default meta');
      expect(source).not.toContain('StoryObj');
      expect(source).not.toContain('defineMeta');
    } else {
      expect(source).not.toContain('preview.meta(');
    }
  });

  it('uses .stories.tsx for every React TypeScript template', () => {
    const templates = [
      'renderers/react/template/cli/ts',
      'frameworks/react-vite/template/cli/ts',
      'frameworks/react-webpack5/template/cli/ts',
      'frameworks/nextjs/template/cli/ts',
      'frameworks/nextjs-vite/template/cli/ts',
      'frameworks/tanstack-react/template/cli/ts',
    ];

    for (const template of templates) {
      const stories = readdirSync(join(repoCode, template)).filter((file) =>
        file.includes('.stories.')
      );

      expect(
        stories.every((file) => file.endsWith('.stories.tsx')),
        `${template}: ${stories}`
      ).toBe(true);
    }
  });

  it('has no unused code in React components under jsx: react-jsx', () => {
    const components = [
      'renderers/react/template/cli/ts',
      'renderers/react/template/cli/js',
      'frameworks/react-vite/template/cli/ts',
      'frameworks/react-vite/template/cli/js',
      'frameworks/react-webpack5/template/cli/ts',
      'frameworks/react-webpack5/template/cli/js',
      'frameworks/nextjs/template/cli/ts',
      'frameworks/nextjs/template/cli/js',
      'frameworks/nextjs-vite/template/cli/ts',
      'frameworks/nextjs-vite/template/cli/js',
      'frameworks/tanstack-react/template/cli/ts',
      'frameworks/react-native-web-vite/template/cli/ts',
      'frameworks/react-native-web-vite/template/cli/js',
    ].flatMap((template) =>
      readdirSync(join(repoCode, template))
        .filter((file) => /\.[jt]sx$/.test(file) && !file.includes('.stories.'))
        .map((file) => join(repoCode, template, file))
    );
    const options: ts.CompilerOptions = {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      checkJs: true,
      noEmit: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      skipLibCheck: true,
      types: [],
    };

    for (const component of components) {
      expect(
        ts.resolveModuleName('react/jsx-runtime', component, options, ts.sys).resolvedModule
          ?.extension,
        component
      ).toBe(ts.Extension.Dts);
    }

    const unused = ts
      .getPreEmitDiagnostics(ts.createProgram(components, options))
      .filter((diagnostic) => diagnostic.reportsUnnecessary);

    expect(
      ts.formatDiagnostics(unused, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => repoCode,
        getNewLine: () => '\n',
      })
    ).toBe('');
  });
});
