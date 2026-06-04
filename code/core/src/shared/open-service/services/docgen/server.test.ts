import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tag } from '../../../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { buildStaticFiles, clearRegistry } from '../../server.ts';
import { registerDocgenService } from './server.ts';
import type { DocgenPayload, DocgenProvider } from './types.ts';

afterEach(() => {
  clearRegistry();
});

function makeStoryEntry(id: string, title = 'Comp'): IndexEntry {
  return {
    id,
    name: id.split('--').slice(1).join('--') || 'Default',
    title,
    type: 'story',
    subtype: 'story',
    importPath: `./${title.toLowerCase()}.stories.tsx`,
  };
}

function makeDocgenPayload(overrides: Partial<DocgenPayload> = {}): DocgenPayload {
  return {
    componentId: 'button',
    name: 'Button',
    path: './button.stories.tsx',
    description: '',
    props: [],
    ...overrides,
  };
}

function makeGetIndex(entries: IndexEntry[]) {
  const index: StoryIndex = {
    v: 5,
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  };
  return () => Promise.resolve(index);
}

describe('docgen open service', () => {
  describe('extractDocgen command', () => {
    it('hands the resolved index entry to the provider, stores its payload, and returns it', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      const payload = makeDocgenPayload({ description: 'A button' });
      const provider = vi.fn<DocgenProvider>(async () => payload);

      const service = registerDocgenService({
        getIndex: makeGetIndex([entry, makeStoryEntry('button--secondary', 'Button')]),
        provider,
      });

      const returned = await service.commands.extractDocgen({ componentId: 'button' });

      expect(returned).toEqual(payload);
      expect(service.queries.getDocgen({ componentId: 'button' })).toEqual(payload);

      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0]).toEqual({ entry });
    });

    it('prefers a story index entry over attached docs for the same componentId', async () => {
      const storyEntry = makeStoryEntry('comp--default', 'Comp');
      const docsEntry = {
        id: 'comp--docs',
        name: 'Docs',
        title: 'Comp/Docs',
        type: 'docs',
        importPath: './comp.mdx',
        storiesImports: ['./wrong.stories.tsx'],
        tags: [Tag.ATTACHED_MDX, 'docs'],
      } satisfies DocsIndexEntry;

      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload());

      const service = registerDocgenService({
        getIndex: makeGetIndex([docsEntry, storyEntry]),
        provider,
      });

      await service.commands.extractDocgen({ componentId: 'comp' });

      expect(provider.mock.calls[0][0]).toEqual({ entry: storyEntry });
    });

    it('returns undefined and leaves state untouched when the provider returns undefined', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => undefined,
      });

      const returned = await service.commands.extractDocgen({ componentId: 'button' });

      expect(returned).toBeUndefined();
      expect(service.queries.getDocgen({ componentId: 'button' })).toBeUndefined();
    });

    it('throws when no entry exists for the componentId', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => undefined,
      });

      await expect(service.commands.extractDocgen({ componentId: 'unknown' })).rejects.toThrow(
        /No story or attached docs entry was found for componentId "unknown"/
      );
    });

    it('propagates provider errors out of the command', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => {
          throw new Error('provider blew up');
        },
      });

      await expect(service.commands.extractDocgen({ componentId: 'button' })).rejects.toThrow(
        'provider blew up'
      );
    });
  });

  describe('getDocgen query', () => {
    it('returns undefined synchronously when nothing has been extracted yet', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => makeDocgenPayload(),
      });

      expect(service.queries.getDocgen({ componentId: 'button' })).toBeUndefined();
    });

    it('.loaded() drives the load body which calls extractDocgen', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => makeDocgenPayload({ description: 'from-loaded' }),
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual(
        makeDocgenPayload({ description: 'from-loaded' })
      );
    });

    it('.loaded() surfaces missing-component errors from the command', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => undefined,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'unknown' })).rejects.toThrow(
        /No story or attached docs entry was found for componentId "unknown"/
      );
    });
  });

  describe('static build', () => {
    it('does not request docgen for componentIds that only exist on unattached docs entries', async () => {
      const storyEntry = makeStoryEntry('button--primary', 'Button');
      const unattachedDocs = {
        id: 'orphan--docs',
        name: 'Docs',
        title: 'Orphan/Docs',
        type: 'docs',
        importPath: './orphan.mdx',
        storiesImports: [],
        tags: [Tag.UNATTACHED_MDX, 'docs'],
      } satisfies DocsIndexEntry;

      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload());

      registerDocgenService({
        getIndex: makeGetIndex([storyEntry, unattachedDocs]),
        provider,
      });

      const store = await buildStaticFiles();

      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0].entry).toEqual(storyEntry);
      expect(Object.keys(store)).toEqual(['core/docgen/button.json']);
    });

    it('writes one docgen JSON per componentId whose provider produced a payload', async () => {
      registerDocgenService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('button--secondary', 'Button'),
          makeStoryEntry('card--default', 'Card'),
        ]),
        provider: async ({ entry }) => {
          const isButton = entry.importPath.includes('button');
          return makeDocgenPayload({
            componentId: isButton ? 'button' : 'card',
            name: isButton ? 'Button' : 'Card',
            path: entry.importPath,
            description: `from ${entry.importPath}`,
          });
        },
      });

      const store = await buildStaticFiles();

      expect(Object.keys(store).sort()).toEqual([
        'core/docgen/button.json',
        'core/docgen/card.json',
      ]);
      expect(store['core/docgen/button.json']).toMatchObject({
        components: {
          button: {
            componentId: 'button',
            name: 'Button',
            path: './button.stories.tsx',
            description: 'from ./button.stories.tsx',
            props: [],
          },
        },
      });
    });
  });

  describe('provider middleware composition', () => {
    it('lets a wrapping provider delegate to nextDocgen and merge its output', async () => {
      const inner: DocgenProvider = async () => makeDocgenPayload({ name: 'inner-name' });

      const outer: DocgenProvider = async (input) => {
        const downstream = await inner(input);
        if (!downstream) {
          return undefined;
        }
        return { ...downstream, description: 'outer-description' };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: outer,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual(
        makeDocgenPayload({ name: 'inner-name', description: 'outer-description' })
      );
    });

    it('merges output from three stacked providers (identity → A → B)', async () => {
      const makeProp = (name: string) => ({
        name,
        required: false,
        type: { name: 'string' },
        description: '',
        defaultValue: null,
      });

      // Identity seed produced by core's services preset.
      const identity: DocgenProvider = async () => undefined;

      // First provider: sets a name and adds a prop.
      const providerA: DocgenProvider = async (input) => {
        await identity(input);
        return makeDocgenPayload({ name: 'A-name', props: [makeProp('a')] });
      };

      // Second provider: appends to description and stacks another prop.
      const providerB: DocgenProvider = async (input) => {
        const downstream = await providerA(input);
        if (!downstream) {
          return undefined;
        }
        return {
          ...downstream,
          description: `${downstream.description}B-description`,
          props: [...downstream.props, makeProp('b')],
        };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: providerB,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual(
        makeDocgenPayload({
          name: 'A-name',
          description: 'B-description',
          props: [makeProp('a'), makeProp('b')],
        })
      );
    });

    it('propagates undefined from the bottom of the chain when no provider has docgen', async () => {
      const identity: DocgenProvider = async () => undefined;
      const passthrough: DocgenProvider = async (input) => identity(input);

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: passthrough,
      });

      await service.commands.extractDocgen({ componentId: 'button' });
      expect(service.queries.getDocgen({ componentId: 'button' })).toBeUndefined();
    });
  });
});
