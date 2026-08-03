import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import {
  OpenServiceDocgenMissingComponentError,
  OpenServiceMissingServiceError,
} from '../../../../server-errors.ts';
import type { ToolsetCtx } from '../../toolset-definition.ts';
import { docsToolset } from './definition.ts';

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
  // Per-id component loads throw when the id has no component entry, like the real
  // extraction service — standalone docs ids and unknown ids both hit that path.
  docgen.mockImplementation(async ({ id }: { id: string }) => {
    if (id !== 'button') {
      throw new OpenServiceDocgenMissingComponentError({ id });
    }
    return buttonDocgen;
  });
  storyDocs.mockImplementation(async ({ id }: { id: string }) => {
    if (id !== 'button') {
      throw new OpenServiceDocgenMissingComponentError({ id });
    }
    return buttonStoryDocs;
  });
  mdxForComponent.mockImplementation(async ({ id }: { id: string }) =>
    id === 'guide--docs' ? guideMdx : undefined
  );
});

describe('docs API', () => {
  it('renders the list and its structured data after loading services through context', async () => {
    const outcome = await docsToolset.methods.list.handler(
      v.parse(docsToolset.methods.list.schema, { withStoryIds: true }),
      ctx
    );

    expect(outcome.markdown).toBe(
      [
        '# Components',
        '',
        '- Button (button): A button',
        '  - Primary (button--primary)',
        '',
        '# Docs',
        '',
        '- Guide (guide--docs): Intro',
      ].join('\n')
    );
    expect(outcome.data).toEqual({
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
    expect(ctx.getService).toHaveBeenCalledWith('core/docgen', { internal: true });
    expect(ctx.getService).toHaveBeenCalledWith('core/story-docs', { internal: true });
    expect(ctx.getService).toHaveBeenCalledWith('addon-docs/mdx', { internal: true });
  });

  it('shows component and story documentation via per-id loaders', async () => {
    const shown = await docsToolset.methods.show.handler(
      v.parse(docsToolset.methods.show.schema, { id: 'button' }),
      ctx
    );

    expect(shown.markdown).toContain('Button');
    expect(docgen).toHaveBeenCalledWith({ id: 'button' });
    expect(storyDocs).toHaveBeenCalledWith({ id: 'button' });

    const shownStory = await docsToolset.methods.showStory.handler(
      v.parse(docsToolset.methods.showStory.schema, {
        componentId: 'button',
        storyName: 'Primary',
      }),
      ctx
    );

    expect(shownStory.markdown).toBe(
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
    const outcome = await docsToolset.methods.show.handler(
      v.parse(docsToolset.methods.show.schema, { id: 'missing' }),
      ctx
    );

    expect(outcome.data).toEqual({ kind: 'not-found', id: 'missing' });
  });

  it('shows a standalone docs entry, whose id has no component payloads', async () => {
    const outcome = await docsToolset.methods.show.handler(
      v.parse(docsToolset.methods.show.schema, { id: 'guide--docs' }),
      ctx
    );

    expect(outcome.data).toMatchObject({ kind: 'docs', id: 'guide--docs' });
  });

  it('mirrors the @storybook/mcp miss messages for the MCP consumer', async () => {
    ctx.consumer = 'mcp';

    const shown = await docsToolset.methods.show.handler(
      v.parse(docsToolset.methods.show.schema, { id: 'missing' }),
      ctx
    );

    expect(shown.markdown).toBe(
      'Component or Docs Entry not found: "missing". Use the list-all-documentation tool to see available components and documentation entries.'
    );

    const shownStory = await docsToolset.methods.showStory.handler(
      v.parse(docsToolset.methods.showStory.schema, { componentId: 'missing', storyName: 'X' }),
      ctx
    );

    expect(shownStory.markdown).toBe(
      'Component not found: "missing". Use the list-all-documentation tool to see available components.'
    );
  });

  it('continues without MDX when the optional service is unavailable', async () => {
    mdxAvailable = false;

    const outcome = await docsToolset.methods.list.handler(
      v.parse(docsToolset.methods.list.schema, {}),
      ctx
    );

    expect(outcome.data).toEqual({
      components: [{ id: 'button', name: 'Button', summary: 'A button' }],
      docs: [],
    });
  });
});
