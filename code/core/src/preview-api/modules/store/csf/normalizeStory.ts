import { deprecate, logger } from 'storybook/internal/client-logger';
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

import { dedent } from 'ts-dedent';

import { normalizeArrays } from './normalizeArrays';
import { normalizeInputTypes } from './normalizeInputTypes';

const deprecatedStoryAnnotation = dedent`
CSF .story annotations deprecated; annotate story functions directly:
- StoryFn.story.name => StoryFn.storyName
- StoryFn.story.(parameters|decorators) => StoryFn.(parameters|decorators)
See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#hoisted-csf-annotations for details and codemod.
`;

export function normalizeStory<TRenderer extends Renderer>(
  key: StoryId,
  storyAnnotations: StoryAnnotationsOrFn<TRenderer>,
  meta: NormalizedComponentAnnotations<TRenderer>
): NormalizedStoryAnnotations<TRenderer> {
  const storyObject = storyAnnotations;
  const userStoryFn: ArgsStoryFn<TRenderer> | null =
    typeof storyAnnotations === 'function' ? storyAnnotations : null;

  const { story } = storyObject;
  if (story) {
    logger.debug('deprecated story', story);
    deprecate(deprecatedStoryAnnotation);
  }

  const exportName = storyNameFromExport(key);
  const name =
    (typeof storyObject !== 'function' && storyObject.name) ||
    storyObject.storyName ||
    story?.name ||
    exportName;

  const decorators = [
    ...normalizeArrays(storyObject.decorators),
    ...normalizeArrays(story?.decorators),
  ];
  const parameters = { ...story?.parameters, ...storyObject.parameters };
  const args = { ...story?.args, ...storyObject.args };
  const argTypes = { ...(story?.argTypes as ArgTypes), ...(storyObject.argTypes as ArgTypes) };
  const loaders = [...normalizeArrays(storyObject.loaders), ...normalizeArrays(story?.loaders)];
  const beforeEach = [
    ...normalizeArrays(storyObject.beforeEach),
    ...normalizeArrays(story?.beforeEach),
  ];

  const afterEach = [
    ...normalizeArrays(storyObject.afterEach),
    ...normalizeArrays(story?.afterEach),
  ];
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
