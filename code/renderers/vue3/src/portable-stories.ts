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

import {
  composeStories as originalComposeStories,
  composeStory as originalComposeStory,
  setProjectAnnotations as originalSetProjectAnnotations,
  setDefaultProjectAnnotations,
} from 'storybook/preview-api';
import { h } from 'vue';

import * as defaultProjectAnnotations from './entry-preview';
import type { Meta } from './public-types';
import type { VueRenderer } from './types';

type JSXAble<TElement> = TElement & {
  new (...args: any[]): any;
  $props: any;
};
type MapToJSXAble<T> = {
  [K in keyof T]: JSXAble<T[K]>;
};

/**
 * Function that sets the globalConfig of your Storybook. The global config is the preview module of
 * your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your
 * stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *
 * ```jsx
 * // setup-file.js
 * import { setProjectAnnotations } from '@storybook/vue3';
 * import projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 * ```
 *
 * @param projectAnnotations - E.g. (import projectAnnotations from '../.storybook/preview')
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<any>
    | NamedOrDefaultProjectAnnotations<any>[]
): NormalizedProjectAnnotations<VueRenderer> {
  setDefaultProjectAnnotations(vueProjectAnnotations);
  return originalSetProjectAnnotations(
    projectAnnotations
  ) as NormalizedProjectAnnotations<VueRenderer>;
}

// This will not be necessary once we have auto preset loading
export const vueProjectAnnotations: ProjectAnnotations<VueRenderer> = {
  ...defaultProjectAnnotations,
  /** @deprecated */
  renderToCanvas: (renderContext, canvasElement) => {
    if (renderContext.storyContext.testingLibraryRender == null) {
      return defaultProjectAnnotations.renderToCanvas(renderContext, canvasElement);
    }
    const {
      storyFn,
      storyContext: { testingLibraryRender: render },
    } = renderContext;
    const { unmount } = render(storyFn(), { container: canvasElement });
    return unmount;
  },
};

/**
 * Function that will receive a story along with meta (e.g. a default export from a .stories file)
 * and optionally projectAnnotations e.g. (import * from '../.storybook/preview) and will return a
 * composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 * It's very useful for reusing a story in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *
 * ```jsx
 * import { render } from '@testing-library/vue';
 * import { composeStory } from '@storybook/vue3';
 * import Meta, { Primary as PrimaryStory } from './Button.stories';
 *
 * const Primary = composeStory(PrimaryStory, Meta);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(Primary, { props: { label: 'Hello world' } });
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 * ```
 *
 * @param story
 * @param componentAnnotations - E.g. (import Meta from './Button.stories')
 * @param [projectAnnotations] - E.g. (import * as projectAnnotations from '../.storybook/preview')
 *   this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 * @param [exportsName] - In case your story does not contain a name and you want it to have a name.
 */
export function composeStory<TArgs extends Args = Args>(
  story: StoryAnnotationsOrFn<VueRenderer, TArgs>,
  componentAnnotations: Meta<TArgs | any>,
  projectAnnotations?: ProjectAnnotations<VueRenderer>,
  exportsName?: string
): JSXAble<ComposedStoryFn<VueRenderer, Partial<TArgs>>> {
  const composedStory = originalComposeStory<VueRenderer, TArgs>(
    story as StoryAnnotationsOrFn<VueRenderer, Args>,
    componentAnnotations,
    projectAnnotations,
    globalThis.globalProjectAnnotations ?? vueProjectAnnotations,
    exportsName
  );

  // Returning h(composedStory) instead makes it an actual Vue component renderable by @testing-library/vue, Playwright CT, etc.
  const renderable = (...args: Parameters<typeof composedStory>) => h(composedStory(...args));
  Object.assign(renderable, composedStory);

  // typing this as newable means TS allows it to be used as a JSX element
  // TODO: we should do the same for composeStories as well
  return renderable as unknown as JSXAble<typeof composedStory>;
}

/**
 * Function that will receive a stories import (e.g. `import * as stories from './Button.stories'`)
 * and optionally projectAnnotations (e.g. `import * from '../.storybook/preview`) and will return
 * an object containing all the stories passed, but now as a composed component that has all
 * args/parameters/decorators/etc combined and applied to it.
 *
 * It's very useful for reusing stories in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *
 * ```jsx
 * import { render } from '@testing-library/vue';
 * import { composeStories } from '@storybook/vue3';
 * import * as stories from './Button.stories';
 *
 * const { Primary, Secondary } = composeStories(stories);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(Primary, { props: { label: 'Hello world' } });
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 * ```
 *
 * @param csfExports - E.g. (import * as stories from './Button.stories')
 * @param [projectAnnotations] - E.g. (import * as projectAnnotations from '../.storybook/preview')
 *   this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 */
export function composeStories<TModule extends Store_CSFExports<VueRenderer, any>>(
  csfExports: TModule,
  projectAnnotations?: ProjectAnnotations<VueRenderer>
) {
  // @ts-expect-error Deep down TRenderer['canvasElement'] resolves to canvasElement: unknown but VueRenderer uses WebRenderer where canvasElement is HTMLElement, so the types clash
  const composedStories = originalComposeStories(csfExports, projectAnnotations, composeStory);

  return composedStories as unknown as MapToJSXAble<
    Omit<StoriesWithPartialProps<VueRenderer, TModule>, keyof Store_CSFExports>
  >;
}
