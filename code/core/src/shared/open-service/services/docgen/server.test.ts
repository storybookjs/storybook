import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { buildStaticFiles, clearRegistry } from '../../server.ts';
import { registerDocgenService } from './server.ts';
import type { DocgenProvider } from './types.ts';

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

function makeGetIndex(entries: IndexEntry[]) {
  const index: StoryIndex = {
    v: 5,
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  };
  return () => Promise.resolve(index);
}

describe('docgen open service', () => {
  describe('extractDocgen command', () => {
    it('runs the provider and populates state so getDocgen returns the payload', async () => {
      const provider = vi.fn<DocgenProvider>(async (input) => ({
        componentId: input.componentId,
        name: `Name for ${input.componentId}`,
        description: `Description for ${input.componentId}`,
        props: [],
      }));

      const service = registerDocgenService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('button--secondary', 'Button'),
        ]),
        provider,
      });

      await service.commands.extractDocgen({ componentId: 'button' });

      expect(service.queries.getDocgen({ componentId: 'button' })).toEqual({
        componentId: 'button',
        name: 'Name for button',
        description: 'Description for button',
        props: [],
      });

      // Provider receives the pre-resolved entries for this componentId, not the whole index.
      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0].componentId).toBe('button');
      expect(provider.mock.calls[0][0].entries.map((entry) => entry.id)).toEqual([
        'button--primary',
        'button--secondary',
      ]);
    });

    it('throws when the componentId has no entries in the story index', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async (input) => ({
          componentId: input.componentId,
          name: '',
          description: '',
          props: [],
        }),
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
        provider: async (input) => ({
          componentId: input.componentId,
          name: 'Button',
          description: '',
          props: [],
        }),
      });

      expect(service.queries.getDocgen({ componentId: 'button' })).toBeUndefined();
    });

    it('.loaded() drives the load body which calls extractDocgen', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async (input) => ({
          componentId: input.componentId,
          name: 'Button',
          description: 'from-loaded',
          props: [],
        }),
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual({
        componentId: 'button',
        name: 'Button',
        description: 'from-loaded',
        props: [],
      });
    });

    it('.loaded() surfaces missing-component errors from the command', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async (input) => ({
          componentId: input.componentId,
          name: '',
          description: '',
          props: [],
        }),
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'unknown' })).rejects.toThrow(
        /No story or attached docs entry was found for componentId "unknown"/
      );
    });
  });

  describe('static build', () => {
    it('writes one docgen JSON per unique componentId in the index', async () => {
      registerDocgenService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('button--secondary', 'Button'),
          makeStoryEntry('card--default', 'Card'),
        ]),
        provider: async (input) => ({
          componentId: input.componentId,
          name: `name-${input.componentId}`,
          description: `desc-${input.componentId}`,
          props: [],
        }),
      });

      const store = await buildStaticFiles();

      expect(Object.keys(store).sort()).toEqual(['docgen/button.json', 'docgen/card.json']);
      expect(store['docgen/button.json']).toMatchObject({
        components: {
          button: {
            componentId: 'button',
            name: 'name-button',
            description: 'desc-button',
            props: [],
          },
        },
      });
    });
  });

  describe('provider middleware composition', () => {
    it('lets a wrapping provider delegate to nextDocgen and merge its output', async () => {
      const inner: DocgenProvider = async (input) => ({
        componentId: input.componentId,
        name: 'inner-name',
        description: '',
        props: [],
      });

      const outer: DocgenProvider = async (input) => {
        const downstream = await inner(input);
        return {
          ...downstream,
          description: 'outer-description',
        };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: outer,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual({
        componentId: 'button',
        name: 'inner-name',
        description: 'outer-description',
        props: [],
      });
    });

    it('merges output from three stacked providers (identity → A → B)', async () => {
      // Identity seed produced by core's services preset.
      const identity: DocgenProvider = async (input) => ({
        componentId: input.componentId,
        name: '',
        description: '',
        props: [],
      });

      // First provider: sets a name and adds a prop.
      const providerA: DocgenProvider = async (input) => {
        const downstream = await identity(input);
        return {
          ...downstream,
          name: 'A-name',
          props: [...downstream.props, { source: 'A' }],
        };
      };

      // Second provider: appends to description and stacks another prop.
      const providerB: DocgenProvider = async (input) => {
        const downstream = await providerA(input);
        return {
          ...downstream,
          description: `${downstream.description || ''}B-description`,
          props: [...downstream.props, { source: 'B' }],
        };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: providerB,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual({
        componentId: 'button',
        name: 'A-name',
        description: 'B-description',
        props: [{ source: 'A' }, { source: 'B' }],
      });
    });
  });
});
