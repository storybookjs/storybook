import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SupportedFramework } from 'storybook/internal/types';

import { vol } from 'memfs';

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
    ['renderers/react/template/cli/ts/Button.stories.ts', true],
    ['renderers/vue3/template/cli/ts/Button.stories.ts', true],
    ['renderers/web-components/template/cli/ts/Button.stories.ts', true],
    ['frameworks/react-vite/template/cli/ts/Button.stories.ts', true],
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
});
