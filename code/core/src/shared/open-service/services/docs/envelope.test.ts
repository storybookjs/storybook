import { describe, expect, it } from 'vitest';

import type { DocgenPayload } from '../docgen/types.ts';
import type { StoryDoc, StoryDocsPayload } from '../story-docs/types.ts';
import { buildDocsList, renderComponentDocs, renderStoryDocs } from './envelope.ts';

const API_DESCRIPTION = [
  '## Props',
  '',
  '```ts',
  'export type Props = {',
  '  /** The visible label. */',
  '  label?: string;',
  '};',
  '```',
].join('\n');

function makeDocgen(overrides: Partial<DocgenPayload> = {}): DocgenPayload {
  return {
    id: 'button',
    name: 'Button',
    path: './button.stories.ts',
    jsDocTags: {},
    ...overrides,
  };
}

function makeStory(name: string, overrides: Partial<StoryDoc> = {}): StoryDoc {
  return {
    id: `button--${name.toLowerCase()}`,
    name,
    snippet: `<Button variant="${name.toLowerCase()}" />`,
    ...overrides,
  };
}

function makeStoryDocs(stories: StoryDoc[], overrides: Partial<StoryDocsPayload> = {}) {
  return {
    id: 'button',
    name: 'Button',
    path: './button.stories.ts',
    import: "import { Button } from './Button';",
    stories: Object.fromEntries(stories.map((story) => [story.id, story])),
    ...overrides,
  } satisfies StoryDocsPayload;
}

describe('renderComponentDocs', () => {
  it('renders the header, description, stories, and the API fragment', () => {
    const markdown = renderComponentDocs({
      id: 'button',
      docgen: makeDocgen({ description: 'A button.', apiDescription: API_DESCRIPTION }),
      storyDocs: makeStoryDocs([makeStory('Primary', { description: 'The primary variant.' })]),
    });

    expect(markdown).toBe(
      [
        '# Button',
        '',
        'ID: button',
        '',
        'A button.',
        '',
        '## Stories',
        '',
        '### Primary',
        '',
        'Story ID: button--primary',
        '',
        'The primary variant.',
        '',
        '```',
        "import { Button } from './Button';",
        '',
        '<Button variant="primary" />',
        '```',
        '',
        API_DESCRIPTION,
      ].join('\n')
    );
  });

  it('inserts the API fragment verbatim', () => {
    const apiDescription = '## Anything\n\nnot-markdown-at-all {{ }} ``` <weird>';
    const markdown = renderComponentDocs({
      id: 'button',
      docgen: makeDocgen({ apiDescription }),
    });

    expect(markdown.endsWith(apiDescription)).toBe(true);
  });

  it('caps the story section at three stories and lists the rest by name when a fragment is present', () => {
    const stories = ['Primary', 'Secondary', 'Large', 'Small', 'Ghost'].map((name) =>
      makeStory(name)
    );

    const markdown = renderComponentDocs({
      id: 'button',
      docgen: makeDocgen({ apiDescription: API_DESCRIPTION }),
      storyDocs: makeStoryDocs(stories),
    });

    expect(markdown).toContain('### Primary');
    expect(markdown).toContain('### Secondary');
    expect(markdown).toContain('### Large');
    expect(markdown).not.toContain('### Small');
    expect(markdown).not.toContain('### Ghost');
    expect(markdown).toContain('Other stories: Small, Ghost');
  });

  it('renders every story and no name list when no fragment is present', () => {
    const stories = ['Primary', 'Secondary', 'Large', 'Small', 'Ghost'].map((name) =>
      makeStory(name)
    );

    const markdown = renderComponentDocs({
      id: 'button',
      docgen: makeDocgen(),
      storyDocs: makeStoryDocs(stories),
    });

    for (const name of ['Primary', 'Secondary', 'Large', 'Small', 'Ghost']) {
      expect(markdown).toContain(`### ${name}`);
    }
    expect(markdown).not.toContain('Other stories:');
  });

  it('omits the stories section entirely when there are no stories', () => {
    const markdown = renderComponentDocs({
      id: 'button',
      docgen: makeDocgen({ description: 'A button.' }),
      storyDocs: makeStoryDocs([]),
    });

    expect(markdown).toBe(['# Button', '', 'ID: button', '', 'A button.'].join('\n'));
  });

  it('falls back to the component id when neither payload is available', () => {
    expect(renderComponentDocs({ id: 'button' })).toBe('# button\n\nID: button');
  });
});

describe('renderStoryDocs', () => {
  it('renders one story with its id, description, and snippet', () => {
    const markdown = renderStoryDocs({
      id: 'button',
      storyId: 'button--primary',
      docgen: makeDocgen({ apiDescription: API_DESCRIPTION }),
      storyDocs: makeStoryDocs([makeStory('Primary', { description: 'The primary variant.' })]),
    });

    expect(markdown).toBe(
      [
        '# Button',
        '',
        'ID: button',
        '',
        '### Primary',
        '',
        'Story ID: button--primary',
        '',
        'The primary variant.',
        '',
        '```',
        "import { Button } from './Button';",
        '',
        '<Button variant="primary" />',
        '```',
      ].join('\n')
    );
  });

  it('reports a missing story instead of rendering an empty section', () => {
    const markdown = renderStoryDocs({
      id: 'button',
      storyId: 'button--nope',
      storyDocs: makeStoryDocs([makeStory('Primary')]),
    });

    expect(markdown).toBe(
      [
        '# Button',
        '',
        'Story ID: button--nope',
        '',
        'No documentation was found for this story.',
      ].join('\n')
    );
  });
});

describe('buildDocsList', () => {
  it('lists docgen components with their summary', () => {
    expect(
      buildDocsList({
        button: makeDocgen({ summary: 'Click me' }),
        card: makeDocgen({ id: 'card', name: 'Card', description: 'A card.' }),
      })
    ).toEqual([
      { id: 'button', name: 'Button', summary: 'Click me' },
      { id: 'card', name: 'Card', summary: 'A card.' },
    ]);
  });

  it('includes components that only produced story docs', () => {
    expect(buildDocsList({}, { button: makeStoryDocs([makeStory('Primary')]) })).toEqual([
      { id: 'button', name: 'Button' },
    ]);
  });
});
