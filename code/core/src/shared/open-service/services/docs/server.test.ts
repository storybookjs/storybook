import { afterEach, describe, expect, it } from 'vitest';

import { clearRegistry, describeService, registerService } from '../../server.ts';
import { docgenServiceDef } from '../docgen/definition.ts';
import type { DocgenPayload } from '../docgen/types.ts';
import { storyDocsServiceDef } from '../story-docs/definition.ts';
import type { StoryDoc, StoryDocsPayload } from '../story-docs/types.ts';
import { registerDocsService } from './server.ts';

afterEach(() => {
  clearRegistry();
});

const API_DESCRIPTION = '## Props\n\n```ts\nexport type Props = { label?: string };\n```';

function makeStory(name: string): StoryDoc {
  return {
    id: `button--${name.toLowerCase()}`,
    name,
    snippet: `<Button variant="${name.toLowerCase()}" />`,
  };
}

/**
 * Registers the real `core/docgen` / `core/story-docs` definitions with registration-time command
 * handlers that seed fixture payloads. This keeps the composition path under test identical to
 * production (query `load` → command → state → `core/docs` read) without a story index or providers.
 */
function registerComposedServices(options: {
  docgen?: Record<string, DocgenPayload>;
  storyDocs?: Record<string, StoryDocsPayload>;
}) {
  const docgenPayloads = options.docgen ?? {};
  const storyDocsPayloads = options.storyDocs ?? {};

  registerService(docgenServiceDef, {
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          const payload = docgenPayloads[input.id];
          if (payload) {
            ctx.self.setState((state) => {
              state.components[input.id] = payload;
            });
          }
          return payload;
        },
      },
      extractAllDocgen: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            Object.assign(state.components, docgenPayloads);
          });
        },
      },
    },
  });

  registerService(storyDocsServiceDef, {
    commands: {
      extractStoryDocs: {
        handler: async (input, ctx) => {
          const payload = storyDocsPayloads[input.id];
          if (payload) {
            ctx.self.setState((state) => {
              state.components[input.id] = payload;
            });
          }
          return payload;
        },
      },
      extractAllStoryDocs: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            Object.assign(state.components, storyDocsPayloads);
          });
        },
      },
    },
  });

  return registerDocsService();
}

describe('docs open service', () => {
  it('composes docgen and story-docs into rendered Markdown when awaited through loaded()', async () => {
    const docs = registerComposedServices({
      docgen: {
        button: {
          id: 'button',
          name: 'Button',
          path: './button.stories.ts',
          jsDocTags: {},
          description: 'A button.',
          apiDescription: API_DESCRIPTION,
        },
      },
      storyDocs: {
        button: {
          id: 'button',
          name: 'Button',
          path: './button.stories.ts',
          import: "import { Button } from './Button';",
          stories: Object.fromEntries(
            ['Primary', 'Secondary', 'Large', 'Small'].map((name) => {
              const story = makeStory(name);
              return [story.id, story];
            })
          ),
        },
      },
    });

    // A bare `.get()` reads before anything is extracted, so it only knows the id.
    expect(docs.queries.show.get({ id: 'button' })).toBe('# button\n\nID: button');

    const markdown = await docs.queries.show.loaded({ id: 'button' });

    expect(markdown).toContain('# Button');
    expect(markdown).toContain('ID: button');
    expect(markdown).toContain('A button.');
    // Fragment present → capped at three stories with the rest listed by name.
    expect(markdown).toContain('### Primary');
    expect(markdown).toContain('### Large');
    expect(markdown).not.toContain('### Small');
    expect(markdown).toContain('Other stories: Small');
    expect(markdown).toContain(API_DESCRIPTION);
    expect(markdown).toContain("import { Button } from './Button';");
  });

  it('renders one story through showStory', async () => {
    const docs = registerComposedServices({
      storyDocs: {
        button: {
          id: 'button',
          name: 'Button',
          path: './button.stories.ts',
          stories: { 'button--primary': makeStory('Primary') },
        },
      },
    });

    await expect(
      docs.queries.showStoryDoc.loaded({ id: 'button', storyId: 'button--primary' })
    ).resolves.toBe(
      [
        '# Button',
        '',
        'ID: button',
        '',
        '### Primary',
        '',
        'Story ID: button--primary',
        '',
        '```',
        '<Button variant="primary" />',
        '```',
      ].join('\n')
    );
  });

  it('lists every documented component', async () => {
    const docs = registerComposedServices({
      docgen: {
        button: {
          id: 'button',
          name: 'Button',
          path: './button.stories.ts',
          jsDocTags: {},
          summary: 'Click me',
        },
        card: { id: 'card', name: 'Card', path: './card.stories.ts', jsDocTags: {} },
      },
    });

    await expect(docs.queries.list.loaded(undefined)).resolves.toEqual([
      { id: 'button', name: 'Button', summary: 'Click me' },
      { id: 'card', name: 'Card' },
    ]);
  });

  // Statelessness is the service's defining constraint: with no commands there is no way to mutate
  // state, so rendered markdown can never end up stored (and there is nothing to snapshot).
  it('declares no commands and no static paths', async () => {
    registerComposedServices({});

    const described = await describeService('core/docs');

    expect(described.commands).toEqual({});
    expect(Object.keys(described.queries)).toEqual(['show', 'showStory', 'list']);
    expect(Object.values(described.queries).every((query) => !('staticPath' in query))).toBe(true);
  });
});
