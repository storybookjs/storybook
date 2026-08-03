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

const mcpCtx: ToolsetCtx = { consumer: 'mcp', getService: () => ({}) as never };
const cliCtx: ToolsetCtx = { consumer: 'cli', getService: () => ({}) as never };

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

  it('cross-references the show tool per consumer in its description', () => {
    const describe_ = toolset.methods.list.description;
    const resolved = typeof describe_ === 'function' ? describe_(mcpCtx) : describe_;
    const resolvedCli = typeof describe_ === 'function' ? describe_(cliCtx) : describe_;

    expect(resolved).toContain('get-documentation');
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
      'Component or Docs Entry not found: "nope". Use the list-all-documentation tool to see available components and documentation entries.'
    );

    const cliOutcome = await toolset.methods.show.handler({ id: 'nope' }, cliCtx);
    expect(cliOutcome.markdown).toBe('Component or Docs Entry not found: "nope".');
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
      'Story "Missing" not found for component "button". Available stories: Primary'
    );
  });

  it('answers unknown components with the miss message per consumer', async () => {
    const outcome = await toolset.methods.showStory.handler(
      {
        componentId: 'nope',
        storyName: 'Primary',
      },
      mcpCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Component not found: "nope". Use the list-all-documentation tool to see available components.'
    );

    const cliOutcome = await toolset.methods.showStory.handler(
      { componentId: 'nope', storyName: 'Primary' },
      cliCtx
    );
    expect(cliOutcome.markdown).toBe('Component not found: "nope".');
  });
});
