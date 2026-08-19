import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearSnippetRecipeRenderer, registerSnippetRecipeRenderer } from './recipe-renderer.ts';
import { selectSnippetForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

afterEach(() => {
  clearSnippetRecipeRenderer();
  vi.restoreAllMocks();
});

const payload = (recipe?: unknown): StoryDocsPayload => ({
  id: 'button',
  name: 'Button',
  path: './button.stories.ts',
  stories: {
    'button--primary': { id: 'button--primary', name: 'Primary', snippet: 'SERVER', recipe },
  },
});

describe('selectSnippetForStory with a recipe', () => {
  it('rebuilds the snippet from the args a reader is looking at', () => {
    registerSnippetRecipeRenderer((recipe, args) => `${recipe}:${JSON.stringify(args)}`);

    expect(selectSnippetForStory(payload('RECIPE'), 'button--primary', { label: 'Live' })).toBe(
      'RECIPE:{"label":"Live"}'
    );
  });

  it('keeps the server snippet when nothing can rebuild it', () => {
    const args = { label: 'Live' };

    // No renderer registered - another framework, or the flag off.
    expect(selectSnippetForStory(payload('RECIPE'), 'button--primary', args)).toBe('SERVER');

    registerSnippetRecipeRenderer(() => 'REBUILT');
    // No recipe: the server withheld it because this story must not be rebuilt.
    expect(selectSnippetForStory(payload(), 'button--primary', args)).toBe('SERVER');
    // No args: a caller that has none, such as a cold Code panel.
    expect(selectSnippetForStory(payload('RECIPE'), 'button--primary')).toBe('SERVER');
  });

  it('keeps the server snippet when the renderer declines or throws, and says why once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const args = { label: 'Live' };

    registerSnippetRecipeRenderer(() => undefined);
    expect(selectSnippetForStory(payload('RECIPE'), 'button--primary', args)).toBe('SERVER');
    expect(warn).not.toHaveBeenCalled();

    registerSnippetRecipeRenderer(() => {
      throw new Error('unprintable arg');
    });
    expect(selectSnippetForStory(payload('RECIPE'), 'button--primary', args)).toBe('SERVER');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('still prepends the CSF import block to a rebuilt snippet', () => {
    registerSnippetRecipeRenderer(() => 'REBUILT');

    expect(
      selectSnippetForStory(
        { ...payload('RECIPE'), import: "import { Button } from './button';" },
        'button--primary',
        { label: 'Live' }
      )
    ).toBe("import { Button } from './button';\n\nREBUILT");
  });
});
