import { describe, expect, it, vi } from 'vitest';

import { invokeToolsetMethod, type ToolsetCtx } from '../../toolset-definition.ts';
import type { DocsAccess } from './access.ts';
import { estimateTokens } from '../estimate-tokens.ts';
import { createDocsToolset, type DocsListOutput } from './definition.ts';
import { RequiresOwnMcpError } from './sources.ts';

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
    expect(
      Object.keys((outcome.data as DocsListOutput).manifests!.componentManifest.components)
    ).toEqual(['button']);
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

  it('takes no storybookIds for a single Storybook', async () => {
    const validated = await toolset.methods.list.input['~standard'].validate({
      storybookIds: ['local'],
    });

    expect(validated.issues).toBeDefined();
  });
});

describe('docs.list in a composition', () => {
  const remoteAccess: DocsAccess = {
    list: async () => ({
      componentManifest: {
        v: 1,
        components: { badge: { id: 'badge', name: 'Badge', summary: 'A badge' } },
      },
    }),
    resolve: async () => undefined,
  };
  const composed = createDocsToolset({
    sources: [
      { source: { id: 'local', title: 'Local' }, access: docsAccess },
      {
        source: { id: 'remote', title: 'Remote', url: 'https://remote.example.com' },
        access: remoteAccess,
      },
      {
        source: { id: 'other', title: 'Other', url: 'https://other.example.com' },
        access: remoteAccess,
      },
    ],
  });

  it('lists only the sources named in storybookIds', async () => {
    const outcome = await composed.methods.list.handler(
      { withStoryIds: false, storybookIds: ['remote'] },
      mcpCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toMatchObject({ storybookIds: ['remote'] });
    expect(
      (outcome.data as { sources: { source: { id: string } }[] }).sources.map(
        ({ source }) => source.id
      )
    ).toEqual(['remote']);
    expect(outcome.markdown).toBe(`# Remote
id: remote

## Components

- Badge (badge): A badge`);
  });

  it('refuses storybookIds that name no source, listing the available ones', async () => {
    const outcome = await composed.methods.list.handler(
      { withStoryIds: false, storybookIds: ['remote', 'nope'] },
      mcpCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'Storybook source not found: "nope". Available sources: local, remote, other. Use the docs-list tool to see available sources.'
    );
  });

  it('refuses a cursor it did not issue, saying how to start again', async () => {
    const outcome = await composed.methods.list.handler(
      { withStoryIds: false, cursor: 'not-a-cursor' },
      mcpCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'This cursor was not issued by docs-list. Start again without a cursor: docs-list {}'
    );
  });
});

describe('docs.list over a composition too large for one result', () => {
  const COMPONENTS_PER_SOURCE = 600;
  const bulkAccess: DocsAccess = {
    list: async () => ({
      componentManifest: {
        v: 1,
        components: Object.fromEntries(
          Array.from({ length: COMPONENTS_PER_SOURCE }, (_, index) => [
            `item-${index}`,
            { id: `item-${index}`, name: `Item ${index}`, summary: 'A component that fills pages' },
          ])
        ),
      },
    }),
    resolve: async () => undefined,
  };
  const large = createDocsToolset({
    sources: ['ds1', 'ds2', 'ds3'].map((id, index) => ({
      source: { id, title: `Design system ${index + 1}`, url: `https://${id}.example.com` },
      access: bulkAccess,
    })),
  });

  type Listed = {
    sources: {
      source: { id: string };
      manifests?: { componentManifest: { components: object } };
    }[];
    nextCursor?: string;
  };

  it('opens with an index of the sources and ends with the next-page call', async () => {
    const outcome = await large.methods.list.handler({ withStoryIds: false }, mcpCtx);
    const { nextCursor } = outcome.data as Listed;

    expect(outcome.ok).toBe(true);
    expect(nextCursor).toEqual(expect.any(String));
    expect(outcome.markdown).toMatch(
      /^3 Storybook sources, listed over several pages\. To list only some, pass their ids as storybookIds\.\n\n- ds1: Design system 1 \(600 components, 0 docs\)\n- ds2: Design system 2 \(600 components, 0 docs\)\n- ds3: Design system 3 \(600 components, 0 docs\)\n\n# Design system 1\nid: ds1\n/
    );
    expect(outcome.markdown).toMatch(
      new RegExp(
        `\\n\\nMore entries follow\\. Next page: docs-list \\{"cursor":"${nextCursor}"\\}\\nTo list only some sources: docs-list \\{"storybookIds":\\["<id>"\\]\\}$`
      )
    );
    expect(estimateTokens(outcome.markdown as string)).toBeLessThanOrEqual(20_000);
    expect(outcome.telemetry?.payload).toMatchObject({ paged: true, filtered: false });
  });

  it('spells the next-page call as a command on the CLI', async () => {
    const outcome = await large.methods.list.handler({ withStoryIds: false }, cliCtx);
    const { nextCursor } = outcome.data as Listed;

    expect(outcome.markdown).toContain(
      `\n\nMore entries follow. Next page: npx storybook tools docs list --cursor ${nextCursor}\nTo list only some sources: npx storybook tools docs list --storybookIds '["<id>"]'`
    );
  });

  it('walks to the end with the cursor alone, listing every component once', async () => {
    const seen: string[] = [];
    const pages: string[] = [];
    let cursor: string | undefined;
    do {
      const outcome = await large.methods.list.handler(
        { withStoryIds: false, ...(cursor ? { cursor } : {}) },
        mcpCtx
      );
      expect(outcome.ok).toBe(true);
      const data = outcome.data as Listed;
      for (const { source, manifests } of data.sources) {
        seen.push(
          ...Object.keys(manifests!.componentManifest.components).map((id) => `${source.id}/${id}`)
        );
      }
      pages.push(outcome.markdown as string);
      cursor = data.nextCursor;
    } while (cursor !== undefined);

    expect(pages.length).toBeGreaterThan(1);
    expect(seen).toEqual(
      ['ds1', 'ds2', 'ds3'].flatMap((id) =>
        Array.from({ length: COMPONENTS_PER_SOURCE }, (_, index) => `${id}/item-${index}`)
      )
    );
    for (const page of pages.slice(1)) {
      expect(page).not.toContain('listed over several pages');
    }
    expect(pages.at(-1)).not.toContain('More entries follow');
  });

  it('reads no source that a continuation page starts after', async () => {
    const read: string[] = [];
    const counted = createDocsToolset({
      sources: ['ds1', 'ds2', 'ds3'].map((id, index) => ({
        source: { id, title: `Design system ${index + 1}`, url: `https://${id}.example.com` },
        access: { ...bulkAccess, list: (query) => (read.push(id), bulkAccess.list(query)) },
      })),
    });
    const first = await counted.methods.list.handler({ withStoryIds: false }, mcpCtx);
    const { nextCursor } = first.data as Listed;
    read.length = 0;

    const second = await counted.methods.list.handler(
      { withStoryIds: false, cursor: nextCursor },
      mcpCtx
    );
    const startsIn = (second.data as Listed).sources[0].source.id;

    expect(second.ok).toBe(true);
    expect(startsIn).not.toBe('ds1');
    expect(read).toEqual(['ds1', 'ds2', 'ds3'].slice(['ds1', 'ds2', 'ds3'].indexOf(startsIn)));
  });
});

describe('the storybookId default in a composition', () => {
  it('defaults to the composed Storybook that has no url', async () => {
    const composed = createDocsToolset({
      sources: [
        {
          source: { id: 'remote', title: 'Remote', url: 'https://remote.example.com' },
          access: docsAccess,
        },
        { source: { id: 'main', title: 'Main' }, access: docsAccess },
      ],
    });

    const show = await composed.methods.show.input['~standard'].validate({ id: 'button' });
    const showStory = await composed.methods.showStory.input['~standard'].validate({
      storyId: 'button--primary',
    });

    expect(show).toMatchObject({ value: { id: 'button', storybookId: 'main' } });
    expect(showStory).toMatchObject({ value: { storybookId: 'main' } });
  });

  it('has no default when every source has a url, and names the sources when none is given', async () => {
    const composed = createDocsToolset({
      sources: ['ds1', 'ds2'].map((id) => ({
        source: { id, title: id, url: `https://${id}.example.com` },
        access: docsAccess,
      })),
    });

    const validated = await composed.methods.show.input['~standard'].validate({ id: 'button' });
    expect(validated.issues).toBeUndefined();
    expect((validated as { value: object }).value).toStrictEqual({ id: 'button' });

    const outcome = await composed.methods.show.handler({ id: 'button' }, mcpCtx);
    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(
      'No storybookId was given, and this composition has no Storybook of its own to default to. Available sources: ds1, ds2. Use the docs-list tool to see available sources.'
    );
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

describe('docs.show for an id the requested source does not have', () => {
  const switchComponent = { id: 'switch', name: 'Switch', stories: [] };
  const sourceWith = (component: typeof switchComponent): DocsAccess => ({
    list: async () => ({
      componentManifest: {
        v: 1,
        components: { [component.id]: { id: component.id, name: component.name } },
      },
    }),
    resolve: async (id) => (id === component.id ? { kind: 'component', component } : undefined),
  });
  const local = { source: { id: 'local', title: 'Local' }, access: docsAccess };
  const remote = { source: { id: 'remote', title: 'Remote' }, access: sourceWith(switchComponent) };

  it('shows it from the one other source that has it, and says how to ask that source', async () => {
    const composed = createDocsToolset({ sources: [local, remote] });

    const outcome = await composed.methods.show.handler(
      { id: 'switch', storybookId: 'local' },
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toMatchObject({ storybookId: 'local', resolvedStorybookId: 'remote' });
    expect(outcome.markdown).toBe(
      `> "switch" is not in source "local"; showing it from source "remote". Pass --storybookId remote on follow-up calls for this source.

# Switch

ID: switch`
    );

    const mcpOutcome = await composed.methods.show.handler(
      { id: 'switch', storybookId: 'local' },
      mcpCtx
    );
    expect(mcpOutcome.markdown).toContain('Pass storybookId "remote" on follow-up calls');
  });

  it('lists the sources that have it as ready calls when there are several', async () => {
    const other = { source: { id: 'other', title: 'Other' }, access: sourceWith(switchComponent) };
    const composed = createDocsToolset({ sources: [local, remote, other] });

    const outcome = await composed.methods.show.handler(
      { id: 'switch', storybookId: 'local' },
      cliCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(`Component or Docs Entry not found: "switch" in source "local".

Closest matches:
- Switch: npx storybook tools docs show --id switch --storybookId remote
- Switch: npx storybook tools docs show --id switch --storybookId other

Use the npx storybook tools docs list tool to see available components and documentation entries.`);
  });

  it('suggests close ids as ready calls per transport', async () => {
    const outcome = await toolset.methods.show.handler({ id: 'primary-button' }, cliCtx);

    expect(outcome.ok).toBe(false);
    expect(outcome.data.suggestions).toEqual([{ id: 'button', name: 'Button' }]);
    expect(outcome.markdown).toContain('- Button: npx storybook tools docs show --id button\n');

    const mcpOutcome = await toolset.methods.show.handler({ id: 'primary-button' }, mcpCtx);
    expect(mcpOutcome.markdown).toContain('- Button: docs-show {"id":"button"}\n');
  });

  it('skips a source that cannot be read', async () => {
    const broken = {
      source: { id: 'broken', title: 'Broken' },
      access: {
        list: () => Promise.reject(new Error('offline')),
        resolve: () => Promise.reject(new Error('offline')),
      },
    };
    const composed = createDocsToolset({ sources: [local, broken, remote] });

    const outcome = await composed.methods.show.handler(
      { id: 'switch', storybookId: 'local' },
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data.resolvedStorybookId).toBe('remote');
  });

  it('names the sources it could not read when the id is found nowhere', async () => {
    const privateSource = { id: 'private', title: 'Private', url: 'https://private.example.com' };
    const unreadable = (error: Error): DocsAccess => ({
      list: () => Promise.reject(error),
      resolve: () => Promise.reject(error),
    });
    const composed = createDocsToolset({
      sources: [
        local,
        {
          source: { id: 'offline', title: 'Offline' },
          access: unreadable(new Error('fetch failed')),
        },
        { source: privateSource, access: unreadable(new RequiresOwnMcpError(privateSource)) },
      ],
    });

    const outcome = await composed.methods.show.handler(
      { id: 'switch', storybookId: 'local' },
      cliCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toBe(`Component or Docs Entry not found: "switch" in source "local".

Sources that could not be read:
- offline: fetch failed
- private: private, read it through its own MCP endpoint: https://private.example.com/mcp

Use the npx storybook tools docs list tool to see available components and documentation entries.`);
  });

  it('suggests from the cheaper names listing when a source has one', async () => {
    const list = vi.fn(docsAccess.list);
    const composed = createDocsToolset({
      docsAccess: {
        ...docsAccess,
        list,
        listNames: async () => [{ id: 'button', name: 'PrimaryButton' }],
      },
    });

    const outcome = await composed.methods.show.handler({ id: 'primary-button' }, cliCtx);

    expect(outcome.data.suggestions).toEqual([{ id: 'button', name: 'PrimaryButton' }]);
    expect(list).not.toHaveBeenCalled();
  });

  it('does not suggest the id that just failed in the same source', async () => {
    const composed = createDocsToolset({
      docsAccess: { ...docsAccess, resolve: async () => undefined },
    });

    const outcome = await composed.methods.show.handler({ id: 'button' }, cliCtx);

    expect(outcome.data.suggestions).toBeUndefined();
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

describe('docs.showStory for a component the requested source does not have', () => {
  const emptyAccess: DocsAccess = { list: docsAccess.list, resolve: async () => undefined };
  const composed = (...others: DocsAccess[]) =>
    createDocsToolset({
      sources: [
        { source: { id: 'local', title: 'Local' }, access: emptyAccess },
        ...others.map((access, index) => ({
          source: { id: `ds${index + 1}`, title: `Design system ${index + 1}` },
          access,
        })),
      ],
    });

  it('shows the story from the one other source that has it, and says how to ask that source', async () => {
    const outcome = await composed(docsAccess).methods.showStory.handler(
      { storyId: 'button--primary', storybookId: 'local' },
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toMatchObject({ storybookId: 'local', resolvedStorybookId: 'ds1' });
    expect(outcome.markdown).toMatch(
      /^> "button" is not in source "local"; showing it from source "ds1"\. Pass --storybookId ds1/
    );
    expect(outcome.markdown).toContain('<Button />');
  });

  it('names the source to pass in MCP words', async () => {
    const outcome = await composed(docsAccess).methods.showStory.handler(
      { storyId: 'button--primary', storybookId: 'local' },
      mcpCtx
    );

    expect(outcome.markdown).toMatch(
      /^> "button" is not in source "local"; showing it from source "ds1"\. Pass storybookId "ds1"/
    );
  });

  it('still reports the component missing when several sources have it', async () => {
    const outcome = await composed(docsAccess, docsAccess).methods.showStory.handler(
      { storyId: 'button--primary', storybookId: 'local' },
      cliCtx
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.markdown).toContain('Story not found: "button--primary"');
  });
});

describe('a composed source that requires its own MCP', () => {
  const privateSource = { id: 'private', title: 'Private', url: 'https://private.example.com' };
  const composed = createDocsToolset({
    sources: [
      { source: { id: 'local', title: 'Local' }, access: docsAccess },
      {
        source: privateSource,
        access: {
          list: () => Promise.reject(new RequiresOwnMcpError(privateSource)),
          resolve: () => Promise.reject(new RequiresOwnMcpError(privateSource)),
        },
      },
    ],
  });
  const notice = `# Private
id: private

This composed Storybook is private and cannot be read through the local Storybook MCP proxy.

Use this source's own MCP endpoint instead:
https://private.example.com/mcp`;

  it('answers show with the own-MCP notice', async () => {
    const outcome = await composed.methods.show.handler(
      { id: 'button', storybookId: 'private' },
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.markdown).toBe(notice);
  });

  it('answers showStory with the own-MCP notice', async () => {
    const outcome = await composed.methods.showStory.handler(
      { storyId: 'button--primary', storybookId: 'private' },
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.markdown).toBe(notice);
  });
});

describe('usage reporting', () => {
  async function run(methodName: 'list' | 'show' | 'showStory', input: unknown) {
    return (await invokeToolsetMethod(toolset, methodName, input, mcpCtx)).telemetry;
  }

  it('reports a listing', async () => {
    const report = await run('list', { withStoryIds: false });

    expect(report).toEqual({
      toolset: 'docs',
      tool: 'list',
      event: 'tool:docs_list',
      payload: {
        componentCount: 1,
        docsCount: 1,
        resultTokenCount: expect.any(Number),
        sourceCount: undefined,
        paged: false,
        filtered: false,
      },
    });
  });

  it('reports a lookup', async () => {
    const report = await run('show', { id: 'button' });

    expect(report).toEqual({
      toolset: 'docs',
      tool: 'show',
      event: 'tool:docs_show',
      payload: {
        componentId: 'button',
        found: true,
        resolvedElsewhere: false,
        suggestionCount: 0,
        resultTokenCount: expect.any(Number),
      },
    });
  });

  it('reports a miss as not found', async () => {
    const report = await run('show', { id: 'nope' });

    expect(report?.payload).toMatchObject({ componentId: 'nope', found: false });
  });

  it('reports a story lookup by id', async () => {
    const report = await run('showStory', { storyId: 'button--primary' });

    expect(report).toEqual({
      toolset: 'docs',
      tool: 'show-story',
      event: 'tool:docs_showStory',
      payload: {
        found: true,
        storyId: 'button--primary',
        lookup: 'storyId',
        resolvedElsewhere: false,
        resultTokenCount: expect.any(Number),
      },
    });
  });

  it('reports a story lookup by name with the resolved story id', async () => {
    const report = await run('showStory', { componentId: 'button', storyName: 'Primary' });

    expect(report?.payload).toEqual({
      found: true,
      storyId: 'button--primary',
      lookup: 'name',
      resolvedElsewhere: false,
      resultTokenCount: expect.any(Number),
    });
  });

  it('reports a missing story with the requested id', async () => {
    const report = await run('showStory', { storyId: 'button--nope' });

    expect(report?.payload).toMatchObject({
      found: false,
      storyId: 'button--nope',
      lookup: 'storyId',
    });
  });

  it('reports a missing component without a story id', async () => {
    const report = await run('showStory', { componentId: 'nope', storyName: 'Primary' });

    expect(report?.payload).toMatchObject({ found: false, lookup: 'name' });
    expect(report?.payload.storyId).toBeUndefined();
  });
});
