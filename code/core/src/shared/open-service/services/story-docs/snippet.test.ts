import { describe, expect, it, vi } from 'vitest';

import { once } from '../../../../client-logger/index.ts';
import { selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

vi.mock('../../../../client-logger/index.ts', { spy: true });

const payload = (snippetTemplate?: { kind: string }): StoryDocsPayload => ({
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

const template = { kind: 'angular-snippet-template' };

describe('selectSnippetForStory with a snippet template', () => {
  it('rebuilds the snippet from the args a reader is looking at', () => {
    expect(
      selectSnippetForStory(
        payload(template),
        'button--primary',
        { label: 'Live' },
        (snippetTemplate, args) =>
          `${(snippetTemplate as { kind: string }).kind}:${JSON.stringify(args)}`
      )
    ).toBe('angular-snippet-template:{"label":"Live"}');
  });

  it('keeps the server snippet when nothing can rebuild it', () => {
    const args = { label: 'Live' };
    const render = () => 'REBUILT';

    // No renderer: another framework, or the flag off.
    expect(selectSnippetForStory(payload(template), 'button--primary', args)).toBe('SERVER');
    // No template: the server withheld it because this story must not be rebuilt.
    expect(selectSnippetForStory(payload(), 'button--primary', args, render)).toBe('SERVER');
    // No args: a caller that has none, such as a cold Code panel.
    expect(selectSnippetForStory(payload(template), 'button--primary', undefined, render)).toBe(
      'SERVER'
    );
  });

  it('keeps the server snippet when the renderer declines or throws, and says why once', () => {
    const warn = vi.mocked(once.warn).mockImplementation(() => {});
    const args = { label: 'Live' };

    expect(selectSnippetForStory(payload(template), 'button--primary', args, () => undefined)).toBe(
      'SERVER'
    );
    expect(warn).not.toHaveBeenCalled();

    expect(
      selectSnippetForStory(payload(template), 'button--primary', args, () => {
        throw new Error('unprintable arg');
      })
    ).toBe('SERVER');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('still prepends the CSF import block to a rebuilt snippet', () => {
    expect(
      selectSnippetForStory(
        { ...payload(template), import: "import { Button } from './button';" },
        'button--primary',
        { label: 'Live' },
        () => 'REBUILT'
      )
    ).toBe("import { Button } from './button';\n\nREBUILT");
  });
});

describe('selectWarningForStory', () => {
  it('selects the warning attached to the story', () => {
    const storyDocs = payload();
    storyDocs.stories['button--primary']!.warning = 'Incomplete snippet';

    expect(selectWarningForStory(storyDocs, 'button--primary')).toBe('Incomplete snippet');
  });

  it('returns undefined when the story has no warning', () => {
    expect(selectWarningForStory(payload(), 'button--primary')).toBeUndefined();
  });
});
