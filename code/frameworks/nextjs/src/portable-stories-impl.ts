import type {
  Args,
  ComposedStoryFn,
  NamedOrDefaultProjectAnnotations,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Store_CSFExports,
  StoriesWithPartialProps,
  StoryAnnotationsOrFn,
} from 'storybook/internal/types';

import type { Meta, ReactRenderer } from '@storybook/react';

import {
  composeConfigs,
  composeStories as originalComposeStories,
  composeStory as originalComposeStory,
  setProjectAnnotations as originalSetProjectAnnotations,
  setDefaultProjectAnnotations,
} from 'storybook/preview-api';

// ! ATTENTION: This needs to be a relative import so it gets prebundled. This is to avoid ESM issues in Nextjs + Jest setups
import { INTERNAL_DEFAULT_PROJECT_ANNOTATIONS as reactAnnotations } from '../../../renderers/react/src/portable-stories.tsx';

export function createPortableStoriesImpl(nextJsAnnotations: ProjectAnnotations<ReactRenderer>) {
  const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<ReactRenderer> = composeConfigs([
    reactAnnotations,
    nextJsAnnotations,
  ]);

  function setProjectAnnotations(
    projectAnnotations:
      | NamedOrDefaultProjectAnnotations<any>
      | NamedOrDefaultProjectAnnotations<any>[]
  ): NormalizedProjectAnnotations<ReactRenderer> {
    setDefaultProjectAnnotations(INTERNAL_DEFAULT_PROJECT_ANNOTATIONS);
    return originalSetProjectAnnotations(
      projectAnnotations
    ) as NormalizedProjectAnnotations<ReactRenderer>;
  }

  function composeStory<TArgs extends Args = Args>(
    story: StoryAnnotationsOrFn<ReactRenderer, TArgs>,
    componentAnnotations: Meta<TArgs | any>,
    projectAnnotations?: ProjectAnnotations<ReactRenderer>,
    exportsName?: string
  ): ComposedStoryFn<ReactRenderer, Partial<TArgs>> {
    return originalComposeStory<ReactRenderer, TArgs>(
      story as StoryAnnotationsOrFn<ReactRenderer, Args>,
      componentAnnotations,
      projectAnnotations,
      globalThis.globalProjectAnnotations ?? INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
      exportsName
    );
  }

  function composeStories<TModule extends Store_CSFExports<ReactRenderer, any>>(
    csfExports: TModule,
    projectAnnotations?: ProjectAnnotations<ReactRenderer>
  ) {
    // @ts-expect-error (Converted from ts-ignore)
    const composedStories = originalComposeStories(csfExports, projectAnnotations, composeStory);

    return composedStories as unknown as Omit<
      StoriesWithPartialProps<ReactRenderer, TModule>,
      keyof Store_CSFExports
    >;
  }

  return { setProjectAnnotations, composeStory, composeStories, INTERNAL_DEFAULT_PROJECT_ANNOTATIONS };
}
