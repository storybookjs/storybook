import { storyNameFromExport, toId } from 'storybook/internal/csf';
import type {
  ArgTypes,
  ArgsStoryFn,
  NormalizedComponentAnnotations,
  NormalizedStoryAnnotations,
  Renderer,
  StoryAnnotationsOrFn,
  StoryId,
} from 'storybook/internal/types';

import { normalizeArrays } from './normalizeArrays.ts';
import { normalizeInputTypes } from './normalizeInputTypes.ts';

export function normalizeStory<TRenderer extends Renderer>(
  key: StoryId,
  storyAnnotations: StoryAnnotationsOrFn<TRenderer>,
  meta: NormalizedComponentAnnotations<TRenderer>
): NormalizedStoryAnnotations<TRenderer> {
  const storyObject = storyAnnotations;
  const userStoryFn: ArgsStoryFn<TRenderer> | null =
    typeof storyAnnotations === 'function' ? storyAnnotations : null;

  const exportName = storyNameFromExport(key);
  const name =
    (typeof storyObject !== 'function' && storyObject.name) || storyObject.storyName || exportName;

  const decorators = normalizeArrays(storyObject.decorators);
  const parameters = { ...storyObject.parameters };
  const args = { ...storyObject.args };
  const argTypes = { ...(storyObject.argTypes as ArgTypes) };
  const loaders = normalizeArrays(storyObject.loaders);
  const beforeEach = normalizeArrays(storyObject.beforeEach);
  const afterEach = normalizeArrays(storyObject.afterEach);
  const { render, play, tags = [], globals = {} } = storyObject;

  const id = parameters.__id || toId(meta.id, exportName);
  return {
    moduleExport: storyAnnotations,
    id,
    name,
    tags,
    decorators,
    parameters,
    args,
    argTypes: normalizeInputTypes(argTypes),
    loaders,
    beforeEach,
    afterEach,
    globals,
    ...(render && { render }),
    ...(userStoryFn && { userStoryFn }),
    ...(play && { play }),
  };
}
