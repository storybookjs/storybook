import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearSnippetTemplateRenderer,
  registerSnippetTemplateRenderer,
} from './snippet-template-renderer.ts';
import { selectSnippetForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

afterEach(() => {
  clearSnippetTemplateRenderer();
  vi.restoreAllMocks();
});

const payload = (snippetTemplate?: unknown): StoryDocsPayload => ({
  id: 'button',
  name: 'Button',
  path: './button.stories.ts',
  stories: {
    'button--primary': {
      id: 'button--primary',
      name: 'Primary',
      snippet: 'SERVER',
      snippetTemplate,
    },
  },
});

describe('selectSnippetForStory with a snippet template', () => {
  it('rebuilds the snippet from the args a reader is looking at', () => {
    registerSnippetTemplateRenderer(
      (snippetTemplate, args) => `${snippetTemplate}:${JSON.stringify(args)}`
    );

    expect(selectSnippetForStory(payload('TEMPLATE'), 'button--primary', { label: 'Live' })).toBe(
      'TEMPLATE:{"label":"Live"}'
    );
  });

  it('keeps the server snippet when nothing can rebuild it', () => {
    const args = { label: 'Live' };

    // No renderer registered - another framework, or the flag off.
    expect(selectSnippetForStory(payload('TEMPLATE'), 'button--primary', args)).toBe('SERVER');

    registerSnippetTemplateRenderer(() => 'REBUILT');
    // No template: the server withheld it because this story must not be rebuilt.
    expect(selectSnippetForStory(payload(), 'button--primary', args)).toBe('SERVER');
    // No args: a caller that has none, such as a cold Code panel.
    expect(selectSnippetForStory(payload('TEMPLATE'), 'button--primary')).toBe('SERVER');
  });

  it('keeps the server snippet when the renderer declines or throws, and says why once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const args = { label: 'Live' };

    registerSnippetTemplateRenderer(() => undefined);
    expect(selectSnippetForStory(payload('TEMPLATE'), 'button--primary', args)).toBe('SERVER');
    expect(warn).not.toHaveBeenCalled();

    registerSnippetTemplateRenderer(() => {
      throw new Error('unprintable arg');
    });
    expect(selectSnippetForStory(payload('TEMPLATE'), 'button--primary', args)).toBe('SERVER');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('still prepends the CSF import block to a rebuilt snippet', () => {
    registerSnippetTemplateRenderer(() => 'REBUILT');

    expect(
      selectSnippetForStory(
        { ...payload('TEMPLATE'), import: "import { Button } from './button';" },
        'button--primary',
        { label: 'Live' }
      )
    ).toBe("import { Button } from './button';\n\nREBUILT");
  });
});

// The published bundles reach this module through two import paths: `preview/runtime.js` inlines its
// own copy, while a framework registers through `storybook/open-service`, which re-exports a shared
// chunk. A module-level variable therefore had the setter writing one copy and the reader checking
// another - and the failure was silent, indistinguishable from the feature being switched off.
//
// The query string forces a second module instance, which is the only way to reproduce that here.
it('registers across two module instances, the way the published bundles are split', async () => {
  // The query strings defeat the module cache; TypeScript cannot resolve them, hence the casts.
  const registrar = (await import(
    './snippet-template-renderer.ts?instance=framework-side' as string
  )) as typeof import('./snippet-template-renderer.ts');
  const reader = (await import(
    './snippet.ts?instance=preview-side' as string
  )) as typeof import('./snippet.ts');

  registrar.registerSnippetTemplateRenderer(() => 'REBUILT');

  const payload = {
    id: 'button',
    name: 'Button',
    path: './button.stories.ts',
    stories: {
      'button--primary': {
        id: 'button--primary',
        name: 'Primary',
        snippet: 'SERVER',
        snippetTemplate: {},
      },
    },
  };

  expect(reader.selectSnippetForStory(payload, 'button--primary', { label: 'Live' })).toBe(
    'REBUILT'
  );
});
