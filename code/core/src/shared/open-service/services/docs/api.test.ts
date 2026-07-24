import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { ApiCtx } from '../../../public-api/index.ts';
import { docsApi } from './definition.ts';

const docgenForAllComponents = vi.fn();
const storyDocsForAllComponents = vi.fn();
const mdxForAllComponents = vi.fn();

const services = {
  'core/docgen': {
    queries: {
      docgenForAllComponents: { loaded: docgenForAllComponents },
    },
  },
  'core/story-docs': {
    queries: {
      storyDocsForAllComponents: { loaded: storyDocsForAllComponents },
    },
  },
  'addon-docs/mdx': {
    queries: {
      mdxForAllComponents: { loaded: mdxForAllComponents },
    },
  },
};

let ctx: ApiCtx;
let mdxAvailable: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  mdxAvailable = true;
  ctx = {
    consumer: 'cli',
    origin: 'http://localhost:6006',
    getService: vi.fn((id) => {
      if (id === 'addon-docs/mdx' && !mdxAvailable) {
        throw new Error('Service not registered');
      }
      return services[id as keyof typeof services];
    }) as ApiCtx['getService'],
  };
  docgenForAllComponents.mockResolvedValue({
    button: {
      id: 'button',
      name: 'Button',
      path: './Button.tsx',
      description: 'Click me',
      summary: 'A button',
      jsDocTags: {},
    },
  });
  storyDocsForAllComponents.mockResolvedValue({
    button: {
      id: 'button',
      name: 'Button',
      path: './Button.stories.tsx',
      import: "import { Button } from './Button'",
      stories: {
        'button--primary': {
          id: 'button--primary',
          name: 'Primary',
          snippet: '<Button />',
        },
      },
    },
  });
  mdxForAllComponents.mockResolvedValue({
    'guide--docs': {
      id: 'guide--docs',
      name: 'Guide',
      docs: {
        'guide--docs': {
          id: 'guide--docs',
          name: 'Guide',
          path: './Guide.mdx',
          title: 'Getting started',
          summary: 'Intro',
        },
      },
    },
  });
});

describe('docs API', () => {
  it('returns compact Markdown by default after loading services through context', async () => {
    await expect(
      docsApi.methods.list.handler(
        v.parse(docsApi.methods.list.schema, { withStoryIds: true }),
        ctx
      )
    ).resolves.toBe(
      [
        '# Components',
        '- Button (button): A button',
        '  - button--primary',
        '',
        '# Docs',
        '- Getting started (guide--docs): Intro',
      ].join('\n')
    );
    expect(docgenForAllComponents).toHaveBeenCalledOnce();
    expect(storyDocsForAllComponents).toHaveBeenCalledOnce();
    expect(mdxForAllComponents).toHaveBeenCalledOnce();
    expect(ctx.getService).toHaveBeenCalledWith('core/docgen');
    expect(ctx.getService).toHaveBeenCalledWith('core/story-docs');
    expect(ctx.getService).toHaveBeenCalledWith('addon-docs/mdx');
  });

  it('returns the existing structured mapper result with json true', async () => {
    await expect(
      docsApi.methods.list.handler(
        v.parse(docsApi.methods.list.schema, { withStoryIds: true, json: true }),
        ctx
      )
    ).resolves.toEqual({
      components: [
        { id: 'button', name: 'Button', summary: 'A button', storyIds: ['button--primary'] },
      ],
      docs: [{ id: 'guide--docs', name: 'Guide', title: 'Getting started', summary: 'Intro' }],
    });
  });

  it('formats component and story documentation while loading each dependency', async () => {
    await expect(
      docsApi.methods.show.handler(v.parse(docsApi.methods.show.schema, { id: 'button' }), ctx)
    ).resolves.toContain('# Button\n\nClick me');

    await expect(
      docsApi.methods.showStory.handler(
        v.parse(docsApi.methods.showStory.schema, {
          componentId: 'button',
          storyName: 'Primary',
        }),
        ctx
      )
    ).resolves.toBe(
      [
        '# Button - Primary',
        '',
        '```',
        "import { Button } from './Button'",
        '',
        '<Button />',
        '```',
      ].join('\n')
    );
  });

  it('returns the existing not-found result for unknown ids', async () => {
    await expect(
      docsApi.methods.show.handler(
        v.parse(docsApi.methods.show.schema, { id: 'missing', json: true }),
        ctx
      )
    ).resolves.toEqual({ kind: 'not-found', id: 'missing' });
  });

  it('continues without MDX when the optional service is unavailable', async () => {
    mdxAvailable = false;

    await expect(
      docsApi.methods.list.handler(v.parse(docsApi.methods.list.schema, { json: true }), ctx)
    ).resolves.toEqual({
      components: [{ id: 'button', name: 'Button', summary: 'A button' }],
      docs: [],
    });
  });

  it('creates a definition containing only public API fields', () => {
    expect(Object.keys(docsApi)).toEqual(['id', 'description', 'methods']);
    for (const method of Object.values(docsApi.methods)) {
      expect(Object.keys(method).sort()).toEqual(['description', 'handler', 'schema']);
    }
  });
});
