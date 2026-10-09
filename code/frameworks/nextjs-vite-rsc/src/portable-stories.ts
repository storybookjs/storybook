import type {
  Args,
  ComposedStoryFn,
  NamedOrDefaultProjectAnnotations,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
  Store_CSFExports,
  StoriesWithPartialProps,
  StoryAnnotationsOrFn,
} from 'storybook/internal/types';
import {
  composeConfigs,
  composeStories as composeStoriesBase,
  composeStory as composeStoryBase,
  setDefaultProjectAnnotations,
  setProjectAnnotations as setProjectAnnotationsBase,
} from 'storybook/preview-api';

import * as frameworkAnnotations from './entry-preview.tsx';
import type { Meta, NextJsRscTypes } from './types.ts';

// Stories of CSF 3 outside Storybook. A story of CSF Next has this already, as `Story.run()`.

/** The annotations of the framework, under the ones of the project. */
export const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<NextJsRscTypes> =
  composeConfigs([frameworkAnnotations as unknown as ProjectAnnotations<NextJsRscTypes>]);

/**
 * Sets the annotations of the project, `.storybook/preview`, for the stories
 * that `composeStories()` and `composeStory()` compose. Call it once, in a
 * setup file.
 *
 * @example
 *   import { setProjectAnnotations } from "@storybook/nextjs-vite-rsc";
 *   import * as preview from "./.storybook/preview";
 *
 *   setProjectAnnotations(preview);
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<any>
    | NamedOrDefaultProjectAnnotations<any>[]
): NormalizedProjectAnnotations<NextJsRscTypes> {
  setDefaultProjectAnnotations(INTERNAL_DEFAULT_PROJECT_ANNOTATIONS);
  return setProjectAnnotationsBase(
    projectAnnotations
  ) as NormalizedProjectAnnotations<NextJsRscTypes>;
}

/**
 * A story of a story file with its meta and the annotations of the project,
 * which `run()` renders and plays as Storybook does.
 */
export function composeStory<TArgs extends Args = Args>(
  story: StoryAnnotationsOrFn<NextJsRscTypes, TArgs>,
  componentAnnotations: Meta<TArgs | any>,
  projectAnnotations?: ProjectAnnotations<NextJsRscTypes>,
  exportsName?: string
): ComposedStoryFn<NextJsRscTypes, Partial<TArgs>> {
  return composeStoryBase(
    story as StoryAnnotationsOrFn<NextJsRscTypes, Args>,
    componentAnnotations,
    projectAnnotations,
    // What `setProjectAnnotations()` set, which has the framework's: as
    // `@storybook/react` composes a story.
    (globalThis as { globalProjectAnnotations?: ProjectAnnotations<NextJsRscTypes> })
      .globalProjectAnnotations ?? INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
    exportsName
  ) as ComposedStoryFn<NextJsRscTypes, Partial<TArgs>>;
}

/** Every story of a story file, as `composeStory()` composes it. */
export function composeStories<TModule extends Store_CSFExports<NextJsRscTypes, any>>(
  csfExports: TModule,
  projectAnnotations?: ProjectAnnotations<NextJsRscTypes>
): Omit<StoriesWithPartialProps<NextJsRscTypes, TModule>, keyof Store_CSFExports> {
  return composeStoriesBase(
    csfExports as unknown as Store_CSFExports,
    projectAnnotations as ProjectAnnotations<Renderer>,
    composeStory as unknown as Parameters<typeof composeStoriesBase>[2]
  ) as unknown as Omit<StoriesWithPartialProps<NextJsRscTypes, TModule>, keyof Store_CSFExports>;
}
