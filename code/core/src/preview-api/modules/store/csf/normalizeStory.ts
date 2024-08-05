import type {
  Renderer,
  ArgTypes,
  LegacyStoryAnnotationsOrFn,
  StoryAnnotations,
  StoryFn,
  StoryId,
} from '@storybook/core/types';
import { storyNameFromExport, toId } from '@storybook/csf';
import { dedent } from 'ts-dedent';
import { logger, deprecate } from '@storybook/core/client-logger';
import { normalizeInputTypes } from './normalizeInputTypes';
import { normalizeArrays } from './normalizeArrays';
import type {
  NormalizedComponentAnnotations,
  NormalizedStoryAnnotations,
} from '@storybook/core/types';

const deprecatedStoryAnnotation = dedent`
CSF .story annotations deprecated; annotate story functions directly:
- StoryFn.story.name => StoryFn.storyName
- StoryFn.story.(parameters|decorators) => StoryFn.(parameters|decorators)
See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#hoisted-csf-annotations for details and codemod.
`;

export function normalizeStory<TRenderer extends Renderer>(
  key: StoryId,
  storyAnnotations: LegacyStoryAnnotationsOrFn<TRenderer>,
  meta: NormalizedComponentAnnotations<TRenderer>
): NormalizedStoryAnnotations<TRenderer> {
  const storyObject: StoryAnnotations<TRenderer> = storyAnnotations;
  const userStoryFn: StoryFn<TRenderer> | null =
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
  const { render, play, tags = [], globals = {} } = storyObject;

  // eslint-disable-next-line no-underscore-dangle
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
    globals,
    ...(render && { render }),
    ...(userStoryFn && { userStoryFn }),
    ...(play && { play }),
  };
}
