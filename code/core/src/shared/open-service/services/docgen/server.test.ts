import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { buildStaticFiles, clearRegistry } from '../../server.ts';
import { registerDocgenService } from './server.ts';
import type { DocgenExtractor } from './types.ts';

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
    it('runs the extractor and populates state so getDocgen returns the payload', async () => {
      const extractor = vi.fn<DocgenExtractor>(async (input) => ({
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
        extractor,
      });

      await service.commands.extractDocgen({ componentId: 'button' });

      expect(service.queries.getDocgen({ componentId: 'button' })).toEqual({
        componentId: 'button',
        name: 'Name for button',
        description: 'Description for button',
        props: [],
      });

      // Extractor receives the pre-resolved entries for this componentId, not the whole index.
      expect(extractor).toHaveBeenCalledTimes(1);
      expect(extractor.mock.calls[0][0].componentId).toBe('button');
      expect(extractor.mock.calls[0][0].entries.map((entry) => entry.id)).toEqual([
        'button--primary',
        'button--secondary',
      ]);
    });

    it('throws when the componentId has no entries in the story index', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        extractor: async (input) => ({
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

    it('propagates extractor errors out of the command', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        extractor: async () => {
          throw new Error('extractor blew up');
        },
      });

      await expect(service.commands.extractDocgen({ componentId: 'button' })).rejects.toThrow(
        'extractor blew up'
      );
    });
  });

  describe('getDocgen query', () => {
    it('returns undefined synchronously when nothing has been extracted yet', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        extractor: async (input) => ({
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
        extractor: async (input) => ({
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
        extractor: async (input) => ({
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
        extractor: async (input) => ({
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

  describe('extractor middleware composition', () => {
    it('lets a wrapping extractor delegate to nextDocgen and merge its output', async () => {
      const inner: DocgenExtractor = async (input) => ({
        componentId: input.componentId,
        name: 'inner-name',
        description: '',
        props: [],
      });

      const outer: DocgenExtractor = async (input) => {
        const downstream = await inner(input);
        return {
          ...downstream,
          description: 'outer-description',
        };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        extractor: outer,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual({
        componentId: 'button',
        name: 'inner-name',
        description: 'outer-description',
        props: [],
      });
    });
  });
});
