import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import { OpenServiceMissingServiceError } from '../../../server-errors.ts';
import type { ToolsetCtx } from '../index.ts';
import { docsApi } from './definition.ts';

const docgenForAllComponents = vi.fn();
const storyDocsForAllComponents = vi.fn();
const mdxForAllComponents = vi.fn();
const docgen = vi.fn();
const storyDocs = vi.fn();
const mdxForComponent = vi.fn();

const services = {
  'core/docgen': {
    queries: {
      docgenForAllComponents: { loaded: docgenForAllComponents },
      docgen: { loaded: docgen },
    },
  },
  'core/story-docs': {
    queries: {
      storyDocsForAllComponents: { loaded: storyDocsForAllComponents },
      storyDocs: { loaded: storyDocs },
    },
  },
  'addon-docs/mdx': {
    queries: {
      mdxForAllComponents: { loaded: mdxForAllComponents },
      mdxForComponent: { loaded: mdxForComponent },
    },
  },
};

let ctx: ToolsetCtx;
let mdxAvailable: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  mdxAvailable = true;
  ctx = {
    consumer: 'cli',
    origin: 'http://localhost:6006',
    getService: vi.fn((id) => {
      if (id === 'addon-docs/mdx' && !mdxAvailable) {
        throw new OpenServiceMissingServiceError({ serviceId: 'addon-docs/mdx' });
      }
      return services[id as keyof typeof services];
    }) as ToolsetCtx['getService'],
  };
  const buttonDocgen = {
    id: 'button',
    name: 'Button',
    path: './Button.tsx',
    description: 'Click me',
    summary: 'A button',
    jsDocTags: {},
  };
  const buttonStoryDocs = {
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
  };
  const guideMdx = {
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
  };
  docgenForAllComponents.mockResolvedValue({ button: buttonDocgen });
  storyDocsForAllComponents.mockResolvedValue({ button: buttonStoryDocs });
  mdxForAllComponents.mockResolvedValue({ 'guide--docs': guideMdx });
  docgen.mockImplementation(async ({ id }: { id: string }) =>
    id === 'button' ? buttonDocgen : undefined
  );
  storyDocs.mockImplementation(async ({ id }: { id: string }) =>
    id === 'button' ? buttonStoryDocs : undefined
  );
  mdxForComponent.mockImplementation(async ({ id }: { id: string }) =>
    id === 'guide--docs' ? guideMdx : undefined
  );
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
    expect(ctx.getService).toHaveBeenCalledWith('core/docgen', { internal: true });
    expect(ctx.getService).toHaveBeenCalledWith('core/story-docs', { internal: true });
    expect(ctx.getService).toHaveBeenCalledWith('addon-docs/mdx', { internal: true });
  });

  it('returns structured JSON when json is true', async () => {
    await expect(
      docsApi.methods.list.handler(
        v.parse(docsApi.methods.list.schema, { withStoryIds: true, json: true }),
        ctx
      )
    ).resolves.toEqual({
      components: [
        {
          id: 'button',
          name: 'Button',
          summary: 'A button',
          storyIds: ['button--primary'],
        },
      ],
      docs: [{ id: 'guide--docs', name: 'Guide', title: 'Getting started', summary: 'Intro' }],
    });
  });

  it('shows component and story documentation via per-id loaders', async () => {
    await expect(
      docsApi.methods.show.handler(v.parse(docsApi.methods.show.schema, { id: 'button' }), ctx)
    ).resolves.toContain('Button');
    expect(docgen).toHaveBeenCalledWith({ id: 'button' });
    expect(storyDocs).toHaveBeenCalledWith({ id: 'button' });

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
    expect(storyDocs).toHaveBeenCalledWith({ id: 'button' });
    expect(mdxForAllComponents).not.toHaveBeenCalled();
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
