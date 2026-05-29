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
    it('hands the entry importPath to the provider and stores its payload', async () => {
      const provider = vi.fn<DocgenProvider>(async () => ({
        componentId: 'button',
        name: 'Button',
        description: 'A button',
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
        name: 'Button',
        description: 'A button',
        props: [],
      });

      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0]).toEqual({ importPath: './button.stories.tsx' });
    });

    it('leaves state untouched when the provider returns undefined', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider: async () => undefined,
      });

      await service.commands.extractDocgen({ componentId: 'button' });

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
        provider: async () => ({
          componentId: 'button',
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
        provider: async () => ({
          componentId: 'button',
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
        provider: async () => undefined,
      });

      await expect(service.queries.getDocgen.loaded({ componentId: 'unknown' })).rejects.toThrow(
        /No story or attached docs entry was found for componentId "unknown"/
      );
    });
  });

  describe('static build', () => {
    it('writes one docgen JSON per componentId whose provider produced a payload', async () => {
      registerDocgenService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('button--secondary', 'Button'),
          makeStoryEntry('card--default', 'Card'),
        ]),
        provider: async ({ importPath }) => ({
          componentId: importPath.includes('button') ? 'button' : 'card',
          name: importPath.includes('button') ? 'Button' : 'Card',
          description: `from ${importPath}`,
          props: [],
        }),
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
            description: 'from ./button.stories.tsx',
            props: [],
          },
        },
      });
    });
  });

  describe('provider middleware composition', () => {
    it('lets a wrapping provider delegate to nextDocgen and merge its output', async () => {
      const inner: DocgenProvider = async () => ({
        componentId: 'button',
        name: 'inner-name',
        description: '',
        props: [],
      });

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

      await expect(service.queries.getDocgen.loaded({ componentId: 'button' })).resolves.toEqual({
        componentId: 'button',
        name: 'inner-name',
        description: 'outer-description',
        props: [],
      });
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
