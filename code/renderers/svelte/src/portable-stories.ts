import {
  composeStory as originalComposeStory,
  composeStories as originalComposeStories,
  setProjectAnnotations as originalSetProjectAnnotations,
} from 'storybook/internal/preview-api';
import type {
  Args,
  ProjectAnnotations,
  StoryAnnotationsOrFn,
  Store_CSFExports,
  StoriesWithPartialProps,
  ComposedStoryFn,
  NamedOrDefaultProjectAnnotations,
} from 'storybook/internal/types';

import * as svelteProjectAnnotations from './entry-preview';
import type { Meta } from './public-types';
import type { SvelteRenderer } from './types';
import PreviewRender from '@storybook/svelte/internal/PreviewRender.svelte';
// @ts-expect-error Don't know why TS doesn't pick up the types export here
import { createSvelte5Props } from '@storybook/svelte/internal/createSvelte5Props';
import { IS_SVELTE_V4 } from './utils';
import { TestingLibraryMustBeConfiguredError } from 'storybook/internal/preview-errors';

type ComposedStory<TArgs extends Args = any> = ComposedStoryFn<SvelteRenderer, TArgs> & {
  Component: typeof PreviewRender;
  // these props current refer to the props of PReviewRender, not the user's component's
  props: any;
};

type MapToComposed<TModule> = {
  [K in keyof TModule]: TModule[K] extends StoryAnnotationsOrFn<
    SvelteRenderer,
    infer TArgs extends Args
  >
    ? ComposedStory<TArgs>
    : never;
};

/** Function that sets the globalConfig of your storybook. The global config is the preview module of your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *```jsx
 * // setup.js (for jest)
 * import { setProjectAnnotations } from '@storybook/svelte';
 * import projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 *```
 *
 * @param projectAnnotations - e.g. (import projectAnnotations from '../.storybook/preview')
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<SvelteRenderer>
    | NamedOrDefaultProjectAnnotations<SvelteRenderer>[]
): ProjectAnnotations<SvelteRenderer> {
  return originalSetProjectAnnotations<SvelteRenderer>(projectAnnotations);
}

// This will not be necessary once we have auto preset loading
export const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<SvelteRenderer> = {
  ...svelteProjectAnnotations,
  renderToCanvas: ({ storyFn, storyContext: { testingLibraryRender: render, canvasElement } }) => {
    if (render == null) throw new TestingLibraryMustBeConfiguredError();
    const { Component, props } = storyFn();
    const { unmount } = render(Component, { props, target: canvasElement });
    return unmount;
  },
};

/**
 * Function that will receive a story along with meta (e.g. a default export from a .stories file)
 * and optionally projectAnnotations e.g. (import * from '../.storybook/preview)
 * and will return a composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 *
 * It's very useful for reusing a story in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *```jsx
 * import { render } from '@testing-library/svelte';
 * import { composeStory } from '@storybook/svelte';
 * import Meta, { Primary as PrimaryStory } from './Button.stories';
 *
 * const Primary = composeStory(PrimaryStory, Meta);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(Primary, { label: 'Hello world' });
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
  story: StoryAnnotationsOrFn<SvelteRenderer, TArgs>,
  componentAnnotations: Meta<TArgs | any>,
  projectAnnotations?: ProjectAnnotations<SvelteRenderer>,
  exportsName?: string
): ComposedStory<TArgs> {
  const composedStory = originalComposeStory<SvelteRenderer, TArgs>(
    story as StoryAnnotationsOrFn<SvelteRenderer, Args>,
    // @ts-expect-error Fix this later: Type 'Partial<{ [x: string]: any; }>' is not assignable to type 'Partial<Simplify<TArgs, {}>>'
    componentAnnotations,
    projectAnnotations,
    INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
    exportsName
  );

  let props = {
    storyFn: composedStory,
    storyContext: { ...composedStory },
    name: composedStory.storyName,
    title: composedStory.id,
    showError: () => {},
  };

  // In Svelte >= 5, we make the props reactive
  if (!IS_SVELTE_V4) {
    props = createSvelte5Props(props);
  }
  /** TODO: figure out the situation here.
   * Currently, we construct props to render the PreviewRender, a "story wrapper" that
   * allows to render the story and its decorators correctly. However, the props
   * from the user's component can't be overwritten in tests e.g.
   * render(Primary.Component, { label: 'Hello world' })
   *
   * In fact, the props that the user has access to are the props for PreviewRender,
   * which should be an internal detail instead.
   *
   * Ideally, we should create a Svelte component with pre-configured props, so users
   * can do something like:
   * render(Primary) instead of render(Primary.Component, Primary.props)
   * */
  const renderable = {
    Component: PreviewRender,
    props,
  };
  Object.assign(renderable, composedStory);

  return renderable as ComposedStory<TArgs>;
}

/**
 * Function that will receive a stories import (e.g. `import * as stories from './Button.stories'`)
 * and optionally projectAnnotations (e.g. `import * from '../.storybook/preview`)
 * and will return an object containing all the stories passed, but now as a composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 *
 * It's very useful for reusing stories in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *```jsx
 * import { render } from '@testing-library/svelte';
 * import { composeStories } from '@storybook/svelte';
 * import * as stories from './Button.stories';
 *
 * const { Primary, Secondary } = composeStories(stories);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(Primary, { label: 'Hello world' });
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 *```
 *
 * @param csfExports - e.g. (import * as stories from './Button.stories')
 * @param [projectAnnotations] - e.g. (import * as projectAnnotations from '../.storybook/preview') this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 */
export function composeStories<TModule extends Store_CSFExports<SvelteRenderer, any>>(
  csfExports: TModule,
  projectAnnotations?: ProjectAnnotations<SvelteRenderer>
) {
  // @ts-expect-error (Converted from ts-ignore)
  const composedStories = originalComposeStories(csfExports, projectAnnotations, composeStory);

  return composedStories as unknown as Omit<
    MapToComposed<StoriesWithPartialProps<SvelteRenderer, TModule>>,
    keyof Store_CSFExports
  >;
}
