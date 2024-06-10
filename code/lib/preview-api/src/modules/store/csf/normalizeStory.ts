import type {
  Renderer,
  ArgTypes,
  LegacyStoryAnnotationsOrFn,
  NormalizedComponentAnnotations,
  NormalizedStoryAnnotations,
  StoryAnnotations,
  StoryFn,
  StoryId,
} from '@storybook/types';
import { storyNameFromExport, toId } from '@storybook/csf';
import { dedent } from 'ts-dedent';
import { logger } from '@storybook/client-logger';
import deprecate from 'util-deprecate';
import { normalizeInputTypes } from './normalizeInputTypes';
import { normalizeArrays } from './normalizeArrays';

const deprecatedStoryAnnotation = dedent`
CSF .story annotations deprecated; annotate story functions directly:
- StoryFn.story.name => StoryFn.storyName
- StoryFn.story.(parameters|decorators) => StoryFn.(parameters|decorators)
See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#hoisted-csf-annotations for details and codemod.
`;

const deprecatedStoryAnnotationWarning = deprecate(() => {}, deprecatedStoryAnnotation);

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
    deprecatedStoryAnnotationWarning();
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
  const { render, play, tags = [] } = storyObject;

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
    ...(render && { render }),
    ...(userStoryFn && { userStoryFn }),
    ...(play && { play }),
  };
}
