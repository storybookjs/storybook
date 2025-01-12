import type { IndexEntry, StoryIndexEntry } from '@storybook/core/types';
import type {
  Addon_Comparator,
  Addon_StorySortParameter,
  Addon_StorySortParameterV7,
  IndexEntryLegacy,
} from '@storybook/core/types';
import type { Parameters, Path, Renderer } from '@storybook/core/types';
import type { PreparedStory } from '@storybook/core/types';

import { dedent } from 'ts-dedent';

import { storySort } from './storySort';

const sortStoriesCommon = (
  stories: IndexEntry[],
  storySortParameter: Addon_StorySortParameterV7,
  fileNameOrder: Path[]
) => {
  if (storySortParameter) {
    let sortFn: Addon_Comparator<any>;
    if (typeof storySortParameter === 'function') {
      sortFn = storySortParameter;
    } else {
      sortFn = storySort(storySortParameter);
    }
    stories.sort(sortFn as (a: IndexEntry, b: IndexEntry) => number);
  } else {
    stories.sort(
      (s1, s2) => fileNameOrder.indexOf(s1.importPath) - fileNameOrder.indexOf(s2.importPath)
    );
  }
  return stories;
};

export const sortStoriesV7 = (
  stories: IndexEntry[],
  storySortParameter: Addon_StorySortParameterV7,
  fileNameOrder: Path[]
) => {
  try {
    return sortStoriesCommon(stories, storySortParameter, fileNameOrder);
  } catch (err) {
    throw new Error(dedent`
    Error sorting stories with sort parameter ${storySortParameter}:

    > ${(err as Error).message}
    
    Are you using a V6-style sort function in V7 mode?

    More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#v7-style-story-sort
  `);
  }
};

const toIndexEntry = (story: any): StoryIndexEntry => {
  const { id, title, name, parameters, type } = story;
  return { id, title, name, importPath: parameters.fileName, type };
};

export const sortStoriesV6 = <TRenderer extends Renderer>(
  stories: [string, PreparedStory<TRenderer>, Parameters, Parameters][],
  storySortParameter: Addon_StorySortParameter,
  fileNameOrder: Path[]
) => {
  if (storySortParameter && typeof storySortParameter === 'function') {
    stories.sort(storySortParameter as (a: IndexEntryLegacy, b: IndexEntryLegacy) => number);
    return stories.map((s) => toIndexEntry(s[1]));
  }

  const storiesV7 = stories.map((s) => toIndexEntry(s[1]));
  return sortStoriesCommon(
    storiesV7,
    storySortParameter as Addon_StorySortParameterV7,
    fileNameOrder
  );
};
