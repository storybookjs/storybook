import { describe, it, expect, vi } from 'vitest';

import type { StoryIndex } from '@storybook/core/types';
import { StoryIndexStore } from './StoryIndexStore';

vi.mock('@storybook/channel-websocket', () => () => ({ on: vi.fn() }));

const storyIndex: StoryIndex = {
  v: 5,
  entries: {
    'component-one--a': {
      type: 'story',
      id: 'component-one--a',
      title: 'Component One',
      name: 'A',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-one--b': {
      type: 'story',
      id: 'component-one--b',
      title: 'Component One',
      name: 'B',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-two--c': {
      type: 'story',
      id: 'component-two--c',
      title: 'Component Two',
      name: 'C',
      importPath: './src/ComponentTwo.stories.js',
    },
  },
};

const makeStoryIndex = (titlesAndNames: any) => {
  return {
    v: 5,
    entries: Object.fromEntries(
      titlesAndNames.map(([title, name]: [any, any]) => {
        const id = `${title}--${name}`.replace('/', '-');
        return [
          id,
          {
            id,
            title,
            name,
            importPath: `./src/${title}.stories.js`,
          },
        ];
      })
    ),
  };
};

describe('StoryIndexStore', () => {
  describe('entryFromSpecifier', () => {
    describe('if you use *', () => {
      it('selects the first story in the store', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(store.entryFromSpecifier('*')).toEqual(store.entries['component-one--a']);
      });

      it('selects nothing if there are no stories', async () => {
        const store = new StoryIndexStore(makeStoryIndex([]));

        expect(store.entryFromSpecifier('*')).toBeUndefined();
      });
    });

    describe('if you use a component or group id', () => {
      it('selects the first story for the component', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(store.entryFromSpecifier('component-two')).toEqual(
          store.entries['component-two--c']
        );
      });

      it('selects the first story for the group', async () => {
        const store = new StoryIndexStore(
          makeStoryIndex([
            ['g1/a', '1'],
            ['g2/a', '1'],
            ['g2/b', '1'],
          ])
        );

        expect(store.entryFromSpecifier('g2')).toEqual(store.entries['g2-a--1']);
      });

      // Making sure the fix #11571 doesn't break this
      it('selects the first story if there are two stories in the group of different lengths', async () => {
        const store = new StoryIndexStore(
          makeStoryIndex([
            ['a', 'long-long-long'],
            ['a', 'short'],
          ])
        );

        expect(store.entryFromSpecifier('a')).toEqual(store.entries['a--long-long-long']);
      });

      it('selects nothing if the component or group does not exist', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(store.entryFromSpecifier('random')).toBeUndefined();
      });
    });
    describe('if you use a storyId', () => {
      it('selects a specific story', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(store.entryFromSpecifier('component-one--a')).toEqual(
          store.entries['component-one--a']
        );
      });

      it('selects nothing if you the story does not exist', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(store.entryFromSpecifier('component-one--c')).toBeUndefined();
      });

      // See #11571
      it('does NOT select an earlier story that this story id is a prefix of', async () => {
        const store = new StoryIndexStore(
          makeStoryIndex([
            ['a', '31'],
            ['a', '3'],
          ])
        );

        expect(store.entryFromSpecifier('a--3')).toEqual(store.entries['a--3']);
      });
    });

    describe('storyIdToEntry', () => {
      it('works when the story exists', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(store.storyIdToEntry('component-one--a')).toEqual(
          storyIndex.entries['component-one--a']
        );
        expect(store.storyIdToEntry('component-one--b')).toEqual(
          storyIndex.entries['component-one--b']
        );
        expect(store.storyIdToEntry('component-two--c')).toEqual(
          storyIndex.entries['component-two--c']
        );
      });

      it('throws when the story does not', async () => {
        const store = new StoryIndexStore(storyIndex);

        expect(() => store.storyIdToEntry('random')).toThrow(
          /Couldn't find story matching id 'random'/
        );
      });
    });
  });

  describe('importPathToEntry', () => {
    it('works', () => {
      const store = new StoryIndexStore(storyIndex);
      expect(store.importPathToEntry('./src/ComponentOne.stories.js')).toEqual(
        storyIndex.entries['component-one--a']
      );
      expect(store.importPathToEntry('./src/ComponentTwo.stories.js')).toEqual(
        storyIndex.entries['component-two--c']
      );
    });
  });
});
