import { describe, expect, it } from 'vitest';

import type { ToolsetCtx } from '../../toolset-definition.ts';
import type { DocsAccess } from './access.ts';
import { createDocsToolset } from './definition.ts';

const button = {
  id: 'button',
  name: 'Button',
  description: 'Click me',
  summary: 'A button',
  stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
  import: "import { Button } from './Button'",
};

const guide = { id: 'guide--docs', name: 'Guide', summary: 'How to' };

/** Fake access: the seam exists precisely so the toolset is testable without services. */
const docsAccess: DocsAccess = {
  list: async ({ withStoryIds }) => ({
    componentManifest: {
      v: 1,
      components: {
        button: {
          id: 'button',
          name: 'Button',
          summary: 'A button',
          ...(withStoryIds ? { stories: button.stories } : {}),
        },
      },
    },
    docsManifest: { v: 1, docs: { 'guide--docs': guide } },
  }),
  resolve: async (id) => {
    if (id === 'button') {
      return { kind: 'component', component: button };
    }
    if (id === 'guide--docs') {
      return { kind: 'doc', doc: guide };
    }
    return undefined;
  },
};

const toolset = createDocsToolset({ docsAccess });

const mcpCtx: ToolsetCtx = { transport: 'mcp', getService: () => ({}) as never };
const cliCtx: ToolsetCtx = { transport: 'cli', getService: () => ({}) as never };

describe('docs.list', () => {
  it('returns the manifests from the access and renders the list Markdown', async () => {
    const outcome = await toolset.methods.list.handler({ withStoryIds: false }, mcpCtx);

    expect(outcome.ok).toBe(true);
    expect(Object.keys(outcome.data.manifests!.componentManifest.components)).toEqual(['button']);
    expect(outcome.markdown).toContain('button');
    expect(outcome.markdown).toContain('Guide');
    expect(outcome.markdown).not.toContain('button--primary');
  });

  it('includes story ids only when requested', async () => {
    const outcome = await toolset.methods.list.handler({ withStoryIds: true }, mcpCtx);

    expect(outcome.markdown).toContain('button--primary');
  });

  it('cross-references the show tool per transport in its description', () => {
    const describe_ = toolset.methods.list.description;
    const resolved = typeof describe_ === 'function' ? describe_(mcpCtx) : describe_;
    const resolvedCli = typeof describe_ === 'function' ? describe_(cliCtx) : describe_;

    expect(resolved).toContain('docs-show');
    expect(resolvedCli).toContain('npx storybook tools docs show');
  });
});

describe('docs.show', () => {
  it('renders component documentation for a known component id', async () => {
    const outcome = await toolset.methods.show.handler({ id: 'button' }, mcpCtx);

    expect(outcome.ok).toBe(true);
    expect(outcome.data.entry?.kind).toBe('component');
    expect(outcome.markdown).toContain('Button');
  });

  it('renders standalone docs entries', async () => {
    const outcome = await toolset.methods.show.handler({ id: 'guide--docs' }, mcpCtx);

    expect(outcome.ok).toBe(true);
    expect(outcome.data.entry?.kind).toBe('doc');
    expect(outcome.markdown).toContain('Guide');
  });

  it('answers unknown ids with a failure carrying the @storybook/mcp miss message', async () => {
    const outcome = await toolset.methods.show.handler({ id: 'nope' }, mcpCtx);

    expect(outcome.ok).toBe(false);
    expect(outcome.data.entry).toBeUndefined();
    expect(outcome.markdown).toBe(
      'Component or Docs Entry not found: "nope". Use the docs-list tool to see available components and documentation entries.'
    );

    const cliOutcome = await toolset.methods.show.handler({ id: 'nope' }, cliCtx);
    expect(cliOutcome.markdown).toContain(
      'Use the npx storybook tools docs list tool to see available components'
    );
  });
});

describe('docs.showStory', () => {
  it('renders the story documentation for a known story name', async () => {
    const outcome = await toolset.methods.showStory.handler(
      {
        componentId: 'button',
        storyName: 'Primary',
      },
      mcpCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.markdown).toContain('<Button />');
  });

  it('lists available stories in a failure when the story name misses', async () => {
    const outcome = await toolset.methods.showStory.handler(
      {
        componentId: 'button',
        storyName: 'Missing',
      },
      mcpCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Story "Missing" not found for component "button". Available stories: Primary (button--primary)'
    );
  });

  it('answers unknown components with the miss message per transport', async () => {
    const outcome = await toolset.methods.showStory.handler(
      {
        componentId: 'nope',
        storyName: 'Primary',
      },
      mcpCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Component not found: "nope". Use the docs-list tool to see available components.'
    );

    const cliOutcome = await toolset.methods.showStory.handler(
      { componentId: 'nope', storyName: 'Primary' },
      cliCtx
    );
    expect(cliOutcome.markdown).toContain(
      'Use the npx storybook tools docs list tool to see available components'
    );
  });

  it('renders the story documentation for a story id, identically to the name lookup', async () => {
    const outcome = await toolset.methods.showStory.handler({ storyId: 'button--primary' }, mcpCtx);

    expect(outcome.ok).toBe(true);
    expect(outcome.data.entry?.kind).toBe('component');

    const byName = await toolset.methods.showStory.handler(
      { componentId: 'button', storyName: 'Primary' },
      mcpCtx
    );
    expect(outcome.markdown).toBe(byName.markdown);
  });

  it('prefers the story id when both shapes are passed', async () => {
    const outcome = await toolset.methods.showStory.handler(
      { storyId: 'button--primary', componentId: 'bogus', storyName: 'Bogus' },
      mcpCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.markdown).toContain('<Button />');
  });

  it('lists available stories with their ids when the story id misses a known component', async () => {
    const outcome = await toolset.methods.showStory.handler({ storyId: 'button--nope' }, mcpCtx);

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Story not found: "button--nope" for component "button". Available stories: Primary (button--primary)'
    );
  });

  it('answers a story id with an unknown component prefix per transport', async () => {
    const outcome = await toolset.methods.showStory.handler({ storyId: 'nope--primary' }, mcpCtx);

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Story not found: "nope--primary". Use the docs-list tool with `withStoryIds: true` to see available stories and their ids.'
    );

    const cliOutcome = await toolset.methods.showStory.handler(
      { storyId: 'nope--primary' },
      cliCtx
    );
    expect(cliOutcome.markdown).toContain(
      'Use the npx storybook tools docs list tool with `withStoryIds: true`'
    );
  });

  it('treats a story id without a separator as a story lookup, not a component lookup', async () => {
    const outcome = await toolset.methods.showStory.handler({ storyId: 'button' }, mcpCtx);

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Story not found: "button" for component "button". Available stories: Primary (button--primary)'
    );
  });

  it('rejects an input that is neither shape with guidance', async () => {
    for (const input of [{}, { componentId: 'button' }, { storyName: 'Primary' }]) {
      const outcome = await toolset.methods.showStory.handler(input, mcpCtx);

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe(
        'Provide either `storyId`, or both `componentId` and `storyName`. Story ids are listed by the docs-list tool with `withStoryIds: true` and in docs-show output.'
      );
    }
  });

  it('accepts both shapes through the input schema', async () => {
    const schema = toolset.methods.showStory.input;

    for (const input of [
      { storyId: 'button--primary' },
      { componentId: 'button', storyName: 'Primary' },
    ]) {
      expect((await schema['~standard'].validate(input)).issues).toBeUndefined();
    }
  });
});

describe('docs.showStory in a composition', () => {
  const sources = [
    { source: { id: 'local', title: 'Local' }, access: docsAccess },
    {
      source: { id: 'remote', title: 'Remote' },
      access: { list: docsAccess.list, resolve: async () => undefined },
    },
  ];
  const composed = createDocsToolset({ sources });

  it('resolves a story id within the named source', async () => {
    const outcome = await composed.methods.showStory.handler(
      { storyId: 'button--primary', storybookId: 'local' },
      mcpCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.markdown).toContain('<Button />');
  });

  it('reports the source error for a story id naming an unknown source', async () => {
    const outcome = await composed.methods.showStory.handler(
      { storyId: 'button--primary', storybookId: 'elsewhere' },
      mcpCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toContain('Storybook source not found: "elsewhere"');
  });
});

describe('usage reporting', () => {
  /** Runs a method the way a transport does; the handler reports usage inline. */
  async function run(methodName: 'list' | 'show', input: unknown, transport: 'cli' | 'mcp') {
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx: ToolsetCtx = {
      transport,
      getService: () => ({}) as never,
      telemetry: async (event, payload) => {
        events.push([event, payload]);
      },
    };

    await toolset.methods[methodName].handler(input as never, ctx);

    return events;
  }

  it.each(['cli', 'mcp'] as const)('reports a listing on %s', async (transport) => {
    const [[event, payload] = []] = await run('list', { withStoryIds: false }, transport);

    expect(event).toBe('tool:listAllDocumentation');
    expect(payload).toMatchObject({ componentCount: 1, docsCount: 1 });
    expect(payload!.resultTokenCount).toBeGreaterThan(0);
  });

  it.each(['cli', 'mcp'] as const)('reports a lookup on %s', async (transport) => {
    const [[event, payload] = []] = await run('show', { id: 'button' }, transport);

    expect(event).toBe('tool:getDocumentation');
    expect(payload).toMatchObject({ componentId: 'button', found: true });
  });

  it('reports a miss as not found', async () => {
    const [[, payload] = []] = await run('show', { id: 'nope' }, 'mcp');

    expect(payload).toMatchObject({ componentId: 'nope', found: false });
  });
});
