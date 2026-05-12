import type { FC, ReactElement } from 'react';
import React, { useContext } from 'react';

import { Tag } from 'storybook/internal/preview-api';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { ResolvedModuleExportFromType } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

import { DocsContext } from './DocsContext';
import { DocsStory } from './DocsStory';
import { Heading } from './Heading';
import type { Of } from './useOf.ts';
import { useOf } from './useOf.ts';
import { withMdxComponentOverride } from './with-mdx-component-override';

interface StoriesProps {
  /** Specify which CSF file's stories are displayed. */
  of?: Of;
  title?: ReactElement | string;
  /** @deprecated Use `includePrimaryStory` instead. */
  includePrimary?: boolean;
  includePrimaryStory?: boolean;
  forceInitialArgs?: boolean;
}

const StyledHeading: typeof Heading = styled(Heading)(({ theme }) => ({
  fontSize: `${theme.typography.size.s2 - 1}px`,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '16px',
  letterSpacing: '0.35em',
  textTransform: 'uppercase',
  color: theme.textMutedColor,
  border: 0,
  marginBottom: '12px',

  '&:first-of-type': {
    // specificity issue
    marginTop: '56px',
  },
}));

const StoriesImpl: FC<StoriesProps> = (props) => {
  const { of, includePrimary, includePrimaryStory } = props;
  const context = useContext(DocsContext);
  const { componentStories, componentStoriesFromCSFFile, projectAnnotations, getStoryContext } =
    context;

  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }

  let resolvedOf: ResolvedModuleExportFromType<'meta'> | undefined;
  try {
    resolvedOf = useOf(of || 'meta', ['meta']);
  } catch (error: unknown) {
    if (
      of ||
      !(error instanceof Error) ||
      !error.message.includes('did you forget to use <Meta of={} />?')
    ) {
      throw error;
    }
  }

  const docsStoriesParameters = resolvedOf?.preparedMeta.parameters.docs?.stories || {};
  const title = props.title ?? docsStoriesParameters.title ?? 'Stories';
  const showPrimaryStory =
    includePrimaryStory ?? includePrimary ?? docsStoriesParameters.includePrimaryStory ?? true;
  const forceInitialArgs = props.forceInitialArgs ?? docsStoriesParameters.forceInitialArgs ?? true;

  let stories =
    of && resolvedOf ? componentStoriesFromCSFFile(resolvedOf.csfFile) : componentStories();
  const { stories: { filter } = { filter: undefined } } = projectAnnotations.parameters?.docs || {};
  if (filter) {
    stories = stories.filter((story) => filter(story, getStoryContext(story)));
  }
  // NOTE: this should be part of the default filter function. However, there is currently
  // no way to distinguish a Stories block in an autodocs page from Stories in an MDX file
  // making https://github.com/storybookjs/storybook/pull/26634 an unintentional breaking change.
  //
  // The new behavior here is that if NONE of the stories in the autodocs page are tagged
  // with 'autodocs', we show all stories. If ANY of the stories have autodocs then we use
  // the new behavior.
  const hasAutodocsTaggedStory = stories.some((story) => story.tags?.includes(Tag.AUTODOCS));
  if (hasAutodocsTaggedStory) {
    // Don't show stories where mount is used in docs.
    // As the play function is not running in docs, and when mount is used, the mounting is happening in play itself.
    stories = stories.filter((story) => story.tags?.includes(Tag.AUTODOCS) && !story.usesMount);
  }

  if (!showPrimaryStory) {
    stories = stories.slice(1);
  }

  if (!stories || stories.length === 0) {
    return null;
  }
  return (
    <>
      {typeof title === 'string' ? <StyledHeading>{title}</StyledHeading> : title}
      {stories.map(
        (story) =>
          story && (
            <DocsStory
              key={story.id}
              of={story.moduleExport}
              expanded
              __forceInitialArgs={forceInitialArgs}
            />
          )
      )}
    </>
  );
};

export const Stories = withMdxComponentOverride('Stories', StoriesImpl);
