/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-underscore-dangle */
export { setViewport } from './viewports';
import type { TaskContext, RunnerTask, TaskMeta } from 'vitest';
import type { UserOptions } from './types';
import { setViewport } from './viewports';

type TagsFilter = Required<UserOptions['tags']>;

export const shouldRun = (storyTags: string[], tagsFilter: TagsFilter) => {
  const isIncluded =
    tagsFilter?.include.length === 0 || tagsFilter?.include.some((tag) => storyTags.includes(tag));
  const isNotExcluded = tagsFilter?.exclude.every((tag) => !storyTags.includes(tag));

  return isIncluded && isNotExcluded;
};

export const shouldSkip = (storyTags: string[], tagsFilter: TagsFilter) => {
  return (
    !shouldRun(storyTags, tagsFilter) || tagsFilter?.skip.some((tag) => storyTags.includes(tag))
  );
};

export const testStory = (
  exportName: string,
  modulePath: string,
  composeStoriesFn: ComposeStoriesFn,
  tagsFilter: TagsFilter
) => {
  return async ({ task, skip }: TaskContext) => {
    const Story = (await getStories(modulePath, composeStoriesFn))[exportName];
    if (Story === undefined || shouldSkip(Story.tags, tagsFilter)) {
      skip();
    }

    const _task = task as RunnerTask & {
      meta: TaskMeta & { storyId: string; hasPlayFunction: boolean };
    };
    _task.meta.storyId = Story.id;
    _task.meta.hasPlayFunction = !!Story.play;
    await setViewport(Story.parameters.viewport);
    const runFn = Story.run ?? Story.play;
    await runFn();
  };
};

type ComposedStories = Record<string, any>;
type ComposeStoriesFn = (module: any) => ComposedStories;

let _cached: ComposedStories | null = null;
export const getStories = async (
  modulePath: string,
  composeStoriesFn: ComposeStoriesFn
): Promise<ComposedStories> => {
  if (_cached) return _cached;
  const stories = (await import(/* @vite-ignore */ modulePath)) as unknown;
  _cached = composeStoriesFn(stories);
  return _cached;
};
