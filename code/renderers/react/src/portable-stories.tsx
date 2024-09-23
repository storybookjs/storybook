import * as React from 'react';

import {
  composeStories as originalComposeStories,
  composeStory as originalComposeStory,
  setProjectAnnotations as originalSetProjectAnnotations,
  setDefaultProjectAnnotations,
} from 'storybook/internal/preview-api';
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

import { act, getReactActEnvironment, setReactActEnvironment } from './act-compat';
import * as reactProjectAnnotations from './entry-preview';
import type { Meta } from './public-types';
import type { ReactRenderer } from './types';

/**
 * Function that sets the globalConfig of your storybook. The global config is the preview module of
 * your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your
 * stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *
 * ```jsx
 * // setup-file.js
 * import { setProjectAnnotations } from '@storybook/react';
 * import projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 * ```
 *
 * @param projectAnnotations - E.g. (import * as projectAnnotations from '../.storybook/preview')
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<any>
    | NamedOrDefaultProjectAnnotations<any>[]
): NormalizedProjectAnnotations<ReactRenderer> {
  setDefaultProjectAnnotations(INTERNAL_DEFAULT_PROJECT_ANNOTATIONS);
  return originalSetProjectAnnotations(
    projectAnnotations
  ) as NormalizedProjectAnnotations<ReactRenderer>;
}

// This will not be necessary once we have auto preset loading
export const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<ReactRenderer> = {
  ...reactProjectAnnotations,
  beforeAll: async function reactBeforeAll() {
    try {
      // copied from
      // https://github.com/testing-library/react-testing-library/blob/3dcd8a9649e25054c0e650d95fca2317b7008576/src/pure.js
      const { configure } = await import('@storybook/test');

      configure({
        unstable_advanceTimersWrapper: (cb) => {
          return act(cb);
        },
        // For more context about why we need disable act warnings in waitFor:
        // https://github.com/reactwg/react-18/discussions/102
        asyncWrapper: async (cb) => {
          const previousActEnvironment = getReactActEnvironment();
          setReactActEnvironment(false);
          try {
            const result = await cb();
            // Drain microtask queue.
            // Otherwise we'll restore the previous act() environment, before we resolve the `waitFor` call.
            // The caller would have no chance to wrap the in-flight Promises in `act()`
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                resolve();
              }, 0);

              if (jestFakeTimersAreEnabled()) {
                // @ts-expect-error global jest
                jest.advanceTimersByTime(0);
              }
            });

            return result;
          } finally {
            setReactActEnvironment(previousActEnvironment);
          }
        },
        eventWrapper: (cb) => {
          let result;
          act(() => {
            result = cb();
          });
          return result;
        },
      });
    } catch (e) {
      // no-op
      // @storybook/test might not be available
    }
  },
  renderToCanvas: async (renderContext, canvasElement) => {
    if (renderContext.storyContext.testingLibraryRender == null) {
      let unmount: () => void;

      await act(async () => {
        unmount = await reactProjectAnnotations.renderToCanvas(renderContext, canvasElement);
      });

      return async () => {
        await act(() => {
          unmount();
        });
      };
    }
    const {
      storyContext: { context, unboundStoryFn: Story, testingLibraryRender: render },
    } = renderContext;
    const { unmount } = render(<Story {...context} />, { container: context.canvasElement });
    return unmount;
  },
};

/**
 * Function that will receive a story along with meta (e.g. a default export from a .stories file)
 * and optionally projectAnnotations e.g. (import * as projectAnnotations from
 * '../.storybook/preview) and will return a composed component that has all
 * args/parameters/decorators/etc combined and applied to it.
 *
 * It's very useful for reusing a story in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *
 * ```jsx
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
 * ```
 *
 * @param story
 * @param componentAnnotations - E.g. (import Meta from './Button.stories')
 * @param [projectAnnotations] - E.g. (import * as projectAnnotations from '../.storybook/preview')
 *   this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 * @param [exportsName] - In case your story does not contain a name and you want it to have a name.
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
 * and optionally projectAnnotations (e.g. `import * as projectAnnotations from
 * '../.storybook/preview`) and will return an object containing all the stories passed, but now as
 * a composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 * It's very useful for reusing stories in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *
 * ```jsx
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
 * ```
 *
 * @param csfExports - E.g. (import * as stories from './Button.stories')
 * @param [projectAnnotations] - E.g. (import * as projectAnnotations from '../.storybook/preview')
 *   this can be applied automatically if you use `setProjectAnnotations` in your setup files.
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

/** The function is used to configure jest's fake timers in environments where React's act is enabled */
function jestFakeTimersAreEnabled() {
  // @ts-expect-error global jest
  if (typeof jest !== 'undefined' && jest !== null) {
    return (
      // legacy timers

      // eslint-disable-next-line no-underscore-dangle
      (setTimeout as any)._isMockFunction === true || // modern timers
      Object.prototype.hasOwnProperty.call(setTimeout, 'clock')
    );
  }

  return false;
}
