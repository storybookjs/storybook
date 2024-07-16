import {
  composeStory as originalComposeStory,
  composeStories as originalComposeStories,
  setProjectAnnotations as originalSetProjectAnnotations,
} from 'storybook/internal/preview-api';
import type {
  Args,
  NamedOrDefaultProjectAnnotations,
  StoryAnnotationsOrFn,
  Store_CSFExports,
  StoriesWithPartialProps,
  ProjectAnnotations,
  ComposedStoryFn,
} from 'storybook/internal/types';

import * as reactProjectAnnotations from './entry-preview';
import type { Meta } from './public-types';
import type { ReactRenderer } from './types';
import { TestingLibraryMustBeConfiguredError } from 'storybook/internal/preview-errors';
import React from 'react';

/** Function that sets the globalConfig of your storybook. The global config is the preview module of your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *```jsx
 * // setup.js (for jest)
 * import { setProjectAnnotations } from '@storybook/react';
 * import projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 *```
 *
 * @param projectAnnotations - e.g. (import * as projectAnnotations from '../.storybook/preview')
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<ReactRenderer>
    | NamedOrDefaultProjectAnnotations<ReactRenderer>[]
): ProjectAnnotations<ReactRenderer> {
  return originalSetProjectAnnotations<ReactRenderer>(projectAnnotations);
}

// This will not be necessary once we have auto preset loading
export const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<ReactRenderer> = {
  ...reactProjectAnnotations,
  renderToCanvas: ({
    storyContext: { context, unboundStoryFn: Story, testingLibraryRender: render, canvasElement },
  }) => {
    if (render == null) throw new TestingLibraryMustBeConfiguredError();
    const { unmount } = render(<Story {...context} />, { baseElement: context.canvasElement });
    return unmount;
  },
};

/**
 * Function that will receive a story along with meta (e.g. a default export from a .stories file)
 * and optionally projectAnnotations e.g. (import * as projectAnnotations from '../.storybook/preview)
 * and will return a composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 *
 * It's very useful for reusing a story in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *```jsx
 * import { render } from '@testing-library/react';
 * import { composeStory } from '@storybook/react';
 * import Meta, { Primary as PrimaryStory } from './Button.stories';
 *
 * const Primary = composeStory(PrimaryStory, Meta);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(<Primary>Hello world</Primary>);
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 *```
 *
 * @param story
 * @param componentAnnotations - e.g. (import Meta from './Button.stories')
 * @param [projectAnnotations] - e.g. (import * as projectAnnotations from '../.storybook/preview') this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 * @param [exportsName] - in case your story does not contain a name and you want it to have a name.
 */
export function composeStory<TArgs extends Args = Args>(
  story: StoryAnnotationsOrFn<ReactRenderer, TArgs>,
  componentAnnotations: Meta<TArgs | any>,
  projectAnnotations?: ProjectAnnotations<ReactRenderer>,
  exportsName?: string
): ComposedStoryFn<ReactRenderer, Partial<TArgs>> {
  return originalComposeStory<ReactRenderer, TArgs>(
    story as StoryAnnotationsOrFn<ReactRenderer, Args>,
    componentAnnotations,
    projectAnnotations,
    INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
    exportsName
  );
}

/**
 * Function that will receive a stories import (e.g. `import * as stories from './Button.stories'`)
 * and optionally projectAnnotations (e.g. `import * as projectAnnotations from '../.storybook/preview`)
 * and will return an object containing all the stories passed, but now as a composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 *
 * It's very useful for reusing stories in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *```jsx
 * import { render } from '@testing-library/react';
 * import { composeStories } from '@storybook/react';
 * import * as stories from './Button.stories';
 *
 * const { Primary, Secondary } = composeStories(stories);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(<Primary>Hello world</Primary>);
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 *```
 *
 * @param csfExports - e.g. (import * as stories from './Button.stories')
 * @param [projectAnnotations] - e.g. (import * as projectAnnotations from '../.storybook/preview') this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 */
export function composeStories<TModule extends Store_CSFExports<ReactRenderer, any>>(
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
