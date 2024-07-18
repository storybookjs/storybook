import {
  composeStory as originalComposeStory,
  composeStories as originalComposeStories,
  setProjectAnnotations as originalSetProjectAnnotations,
} from 'storybook/internal/preview-api';
import {
  Args,
  NamedOrDefaultProjectAnnotations,
  StoryAnnotationsOrFn,
  Store_CSFExports,
  StoriesWithPartialProps,
  ProjectAnnotations,
} from 'storybook/internal/types';
import { TestingLibraryMustBeConfiguredError } from 'storybook/internal/preview-errors';
import { AngularRenderer } from './types';
import { Meta } from './public-types';
import * as angularProjectAnnotations from './entry-preview';
import { createMountable } from './angular-beta/StandaloneRenderer';

/** Function that sets the globalConfig of your storybook. The global config is the preview module of your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *```ts
 * // setup.js (for jest)
 * import { setProjectAnnotations } from '@storybook/angular';
 * import * as projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 *```
 *
 * @param projectAnnotations - e.g. (import * as projectAnnotations from '../.storybook/preview')
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<AngularRenderer>
    | NamedOrDefaultProjectAnnotations<AngularRenderer>[]
) {
  originalSetProjectAnnotations<AngularRenderer>(projectAnnotations);
}

// This will not be necessary once we have auto preset loading
export const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<AngularRenderer> = {
  ...angularProjectAnnotations,
  renderToCanvas: ({
    storyFn,
    storyContext: { context, unboundStoryFn: Story, testingLibraryRender: render, canvasElement },
  }) => {
    if (render == null) throw new TestingLibraryMustBeConfiguredError();
    const { component, applicationConfig } = createMountable(storyFn({ label: 'Hello world' }));
    const { unmount } = render(component, { providers: applicationConfig.providers });
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
 *```ts
 * import { render, screen } from '@testing-library/angular';
 * import {
 *   composeStories,
 *   createMountable,
 * } from '@storybook/testing-angular';
 * import Meta, { Primary as PrimaryStory } from './button.stories';
 *
 * const Primary = composeStory(PrimaryStory, Meta);
 *
 * describe('renders primary button with Hello World', () => {
 *   it('renders primary button with Hello World', async () => {
 *     const { component, applicationConfig } = createMountable(Primary({ label: 'Hello world' }));
 *     await render(component, { providers: applicationConfig.providers });
 *     const buttonElement = screen.getByText(/Hello world/i);
 *     expect(buttonElement).not.toBeNull();
 *   });
 * });
 *```
 *
 * @param story
 * @param componentAnnotations - e.g. (import Meta from './Button.stories')
 * @param [projectAnnotations] - e.g. (import * as projectAnnotations from '../.storybook/preview') this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 * @param [exportsName] - in case your story does not contain a name and you want it to have a name.
 */
export function composeStory<TArgs extends Args = Args>(
  story: StoryAnnotationsOrFn<AngularRenderer, TArgs>,
  componentAnnotations: Meta<TArgs | any>,
  projectAnnotations?: ProjectAnnotations<AngularRenderer>,
  exportsName?: string
) {
  componentAnnotations.decorators = [
    ...(componentAnnotations.decorators ?? ([] as any)),
    (storyInner: any, context: any) => {
      return {
        ...storyInner(context.args),
        // Storybook now retrieves the component from the context, so this is a workaround to preserve the component in composed stories.
        _composedComponent: context.component,
      };
    },
  ];
  return originalComposeStory<AngularRenderer, TArgs>(
    story as StoryAnnotationsOrFn<AngularRenderer, Args>,
    // TODO: Fix types
    componentAnnotations as any,
    projectAnnotations,
    INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
    exportsName
  );
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
 *```ts
 * import { render, screen } from '@testing-library/angular';
 * import {
 *   composeStory,
 *   createMountable,
 * } from '@storybook/testing-angular';
 * import * as stories from './button.stories';
 * import Meta from './button.stories';
 *
 * const { Primary } = composeStories(stories);
 *
 * describe('button', () => {
 *   it('reuses args from composed story', async () => {
 *     const { component, applicationConfig } = createMountable(Primary({}));
 *     await render(component, { providers: applicationConfig.providers });
 *     expect(screen.getByText(Primary.args?.label!)).not.toBeNull();
 *   });
 * });
 *```
 *
 * @param csfExports - e.g. (import * as stories from './Button.stories')
 * @param [projectAnnotations] - e.g. (import * as projectAnnotations from '../.storybook/preview') this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 */
export function composeStories<TModule extends Store_CSFExports<AngularRenderer, any>>(
  csfExports: TModule,
  projectAnnotations?: ProjectAnnotations<AngularRenderer>
) {
  const composedStories = originalComposeStories(csfExports, projectAnnotations, composeStory);

  return composedStories as unknown as Omit<
    StoriesWithPartialProps<AngularRenderer, TModule>,
    keyof Store_CSFExports
  >;
}
