import type { ComponentProps } from 'react';
import React from 'react';

import { Link, SyntaxHighlighter } from 'storybook/internal/components';
import {
  PREVIEW_INITIALIZED,
  STORY_ARGS_UPDATED,
  STORY_FINISHED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import {
  type API_IndexHash,
  type API_PreparedIndexEntry,
  type API_StoryEntry,
} from 'storybook/internal/types';

import { type API, addons, internal_universalTestProviderStore, Tag } from 'storybook/manager-api';
import { ThemeProvider, convert, styled, themes } from 'storybook/theming';

import { ADDON_ID as ADDON_A11Y_ID } from '../../../../addons/a11y/src/constants';
import {
  ADDON_ONBOARDING_CHANNEL,
  ADDON_ID as ADDON_ONBOARDING_ID,
} from '../../../../addons/onboarding/src/constants';
import {
  ADDON_ID as ADDON_TEST_ID,
  STORYBOOK_ADDON_TEST_CHANNEL,
} from '../../../../addons/vitest/src/constants';
import { SUPPORTED_FRAMEWORKS } from '../../cli/AddonVitestService.constants';
import { ADDON_ID as ADDON_DOCS_ID } from '../../docs-tools/shared';
import { TourGuide } from '../../manager/components/TourGuide/TourGuide';
import { LocationMonitor } from '../../manager/hooks/useLocation';
import type { initialState } from './checklistData.state';

const CodeWrapper = styled.div(({ theme }) => ({
  alignSelf: 'stretch',
  background: theme.background.content,
  borderRadius: theme.appBorderRadius,
  margin: '5px 0',
  padding: 10,
  fontSize: theme.typography.size.s1,
  '.linenumber': {
    opacity: 0.5,
  },
}));

const CodeSnippet = (props: ComponentProps<typeof SyntaxHighlighter>) => (
  <ThemeProvider theme={convert(themes.dark)}>
    <CodeWrapper>
      <SyntaxHighlighter {...props} />
    </CodeWrapper>
  </ThemeProvider>
);

type ItemId = keyof (typeof initialState)['items'];

export interface ChecklistData {
  sections: readonly {
    id: string;
    title: string;
    items: readonly {
      /** Unique identifier for persistence. Update when making significant changes. */
      id: ItemId;

      /** Display name. Keep it short and actionable (with a verb). */
      label: string;

      /** Description of the criteria that must be met to complete the item. */
      criteria: string;

      /** Items that must be completed before this item can be completed (locked until then). */
      after?: readonly ItemId[];

      /** What to do after the item is completed (prevent undo or hide the item). */
      afterCompletion?: 'immutable' | 'unavailable';

      /**
       * Function to check if the item should be available (displayed in the checklist). Called any
       * time the index is updated.
       */
      available?: (args: {
        api: API;
        index: API_IndexHash | undefined;
        item: ChecklistData['sections'][number]['items'][number];
      }) => boolean;

      /** Function returning content to display in the checklist item's collapsible area. */
      content?: (args: { api: API }) => React.ReactNode;

      /** Action button to be displayed when item is not completed. */
      action?: {
        label: string;
        onClick: (args: { api: API; accept: () => void }) => void;
      };

      /**
       * Function to subscribe to events and update the item's state. May return a function to
       * unsubscribe once the item is completed.
       */
      subscribe?: (args: {
        api: API;
        item: ChecklistData['sections'][number]['items'][number];

        /**
         * Call this to complete the item and persist to user-local storage. This is preferred when
         * dealing with user-specific criteria (e.g. learning goals).
         */
        accept: () => void;

        /**
         * Call this to complete the item and persist to project-local storage. This is preferred
         * when dealing with project-specific criteria (e.g. component count).
         */
        done: () => void;

        /** Call this to skip the item and persist to user-local storage. */
        skip: () => void;
      }) => void | (() => void);
    }[];
  }[];
}

const isExample = (id: string) =>
  id.startsWith('example-') || id.startsWith('configure-your-project--');

const subscribeToIndex: (
  condition: (entries: Record<string, API_PreparedIndexEntry>) => boolean
) => ChecklistData['sections'][number]['items'][number]['subscribe'] =
  (condition) =>
  ({ api, done }) => {
    const check = () =>
      condition(
        Object.entries(api.getIndex()?.entries || {}).reduce(
          (acc, [id, entry]) => (isExample(entry.id) ? acc : Object.assign(acc, { [id]: entry })),
          {} as Record<string, API_PreparedIndexEntry>
        )
      );
    if (check()) {
      done();
    } else {
      api.once(PREVIEW_INITIALIZED, () => check() && done());
      return api.on(STORY_INDEX_INVALIDATED, () => check() && done());
    }
  };

export const checklistData = {
  sections: [
    {
      id: 'basics',
      title: 'Storybook basics',
      items: [
        {
          id: 'guidedTour',
          label: 'Take the guided tour',
          available: ({ index }) =>
            !!index &&
            'example-button--primary' in index &&
            !!globalThis?.FEATURES?.controls &&
            addons.experimental_getRegisteredAddons().includes(ADDON_ONBOARDING_ID),
          criteria: 'Guided tour is completed',
          subscribe: ({ api, accept }) =>
            api.on(ADDON_ONBOARDING_CHANNEL, ({ step, type }) => {
              if (type !== 'dismiss' && ['6:IntentSurvey', '7:FinishedOnboarding'].includes(step)) {
                accept();
              }
            }),
          action: {
            label: 'Start',
            onClick: ({ api }) => {
              const path = api.getUrlState().path || '';
              if (path.startsWith('/story/')) {
                document.location.href = `/?path=${path}&onboarding=true`;
              } else {
                document.location.href = `/?onboarding=true`;
              }
            },
          },
        },
        {
          id: 'onboardingSurvey',
          label: 'Complete the onboarding survey',
          available: () => addons.experimental_getRegisteredAddons().includes(ADDON_ONBOARDING_ID),
          afterCompletion: 'immutable',
          criteria: 'Onboarding survey is completed',
          subscribe: ({ api, accept }) =>
            api.on(ADDON_ONBOARDING_CHANNEL, ({ type }) => type === 'survey' && accept()),
          action: {
            label: 'Open',
            onClick: ({ api }) => {
              const path = api.getUrlState().path || '';
              document.location.href = `/?path=${path}&onboarding=survey`;
            },
          },
        },
        {
          id: 'renderComponent',
          label: 'Render your first component',
          criteria: 'A story finished rendering successfully',
          subscribe: ({ api, done }) =>
            api.on(
              STORY_FINISHED,
              ({ storyId, status }) => status === 'success' && !isExample(storyId) && done()
            ),
          content: ({ api }) => (
            <>
              <p>
                Storybook renders your components in isolation, using stories. That allows you to
                work on the bit of UI you need, without worrying about the rest of the app.
              </p>
              <p>
                Rendering your components can often require{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-stories/decorators',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  setting up surrounding context in decorators
                </Link>{' '}
                or{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'configure/styling-and-css',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  applying global styles
                </Link>
                . Once you&apos;ve got it working for one component, you&apos;re ready to make
                Storybook the home for all of your UI.
              </p>
              <p>
                Stories are written in CSF, a format specifically designed to help with UI
                development. Here&apos;s an example:
              </p>
              {/* TODO: Non-React snippets? TS vs. JS? */}
              <CodeSnippet language="typescript">
                {`// Button.stories.ts
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
 
import { Button } from './Button';
 
const meta = {
  // 👇 The component you're working on
  component: Button,
} satisfies Meta<typeof Button>;
 
export default meta;
// 👇 Type helper to reduce boilerplate 
type Story = StoryObj<typeof meta>;

// 👇 A story named Primary that renders \`<Button primary label="Button" />\`
export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};`}
              </CodeSnippet>
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-stories',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn more about stories
                </Link>
              </p>
            </>
          ),
        },
        {
          id: 'moreComponents',
          label: 'Add 5 components',
          content: ({ api }) => (
            <>
              <p>
                Storybook gets better as you add more components. Start with the easy ones, like
                Button or Avatar, and work your way up to more complex components, like Select,
                Autocomplete, or even full pages.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'onboarding/sidebar-components.png',
                  ref: 'guide',
                })}
                alt="Components in the sidebar"
              />
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'get-started/whats-a-story#create-a-new-story',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn how to add components without writing any code
                </Link>
              </p>
            </>
          ),
          criteria: 'At least 5 components exist in the index',
          subscribe: subscribeToIndex((entries) => {
            const stories = Object.values(entries).filter(
              (entry): entry is API_StoryEntry => entry.type === 'story'
            );
            const components = new Set(stories.map(({ title }) => title));
            return components.size >= 5;
          }),
        },
        {
          id: 'moreStories',
          label: 'Add 20 stories',
          content: ({ api }) => (
            <>
              <p>
                More stories for your components means better documentation and more test coverage.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'onboarding/sidebar-many-stories.png',
                  ref: 'guide',
                })}
                alt="Stories in the sidebar"
              />
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'essentials/controls#creating-and-editing-stories-from-controls',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn how to use Controls to add stories without writing any code
                </Link>
              </p>
            </>
          ),
          criteria: 'At least 20 stories exist in the index',
          subscribe: subscribeToIndex((entries) => {
            const stories = Object.values(entries).filter(
              (entry): entry is API_StoryEntry => entry.type === 'story'
            );
            return stories.length >= 20;
          }),
        },
        {
          id: 'whatsNewStorybook10',
          label: "See what's new",
          criteria: "What's New page is opened",
          action: {
            label: 'Go',
            onClick: ({ api }) => api.navigate('/settings/whats-new'),
          },
          subscribe: ({ accept }) =>
            LocationMonitor.subscribe((l) => l.search.endsWith('/settings/whats-new') && accept()),
        },
      ],
    },

    {
      id: 'development',
      title: 'Development',
      items: [
        {
          id: 'controls',
          label: 'Change a story with Controls',
          available: () => !!globalThis?.FEATURES?.controls,
          criteria: 'Story args are updated',
          subscribe: ({ api, done }) => api.on(STORY_ARGS_UPDATED, done),
          content: ({ api }) => (
            <>
              <p>
                When you change the value of one of the inputs in the Controls table, the story
                automatically updates to reflect that change. It&apos;s a great way to explore how a
                component handles various inputs.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'api/doc-block-controls.png',
                  ref: 'guide',
                })}
                alt="Screenshot of Controls block"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'essentials/controls',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  Controls documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to use the Controls panel to edit or save a new story</li>
                <li>How to configure the table</li>
              </ul>
            </>
          ),
        },
        {
          id: 'viewports',
          label: 'Check responsiveness with Viewports',
          available: () => !!globalThis?.FEATURES?.viewport,
          criteria: 'Viewport global is updated',
          subscribe: ({ api, done }) =>
            api.on(UPDATE_GLOBALS, ({ globals }) => globals?.viewport && done()),
          content: ({ api }) => (
            <>
              <p>
                Many UI components need to be responsive to the viewport size. Storybook has
                built-in support for previewing stories in various device sizes.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'onboarding/viewports-menu.png',
                  ref: 'guide',
                })}
                alt="Screenshot of Viewports menu"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'essentials/viewport',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  Viewports documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to configure which viewports are available</li>
                <li>
                  How to force a story to <em>always</em> render in a specific viewport
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'organizeStories',
          label: 'Group your components',
          criteria: 'A root node exists in the index',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(({ title }) => title.includes('/'))
          ),
          content: ({ api }) => (
            <>
              <p>
                It&apos;s helpful for projects to organize their sidebar into groups. We&apos;re big
                fans of Atomic Design (atoms, molecules, organisms, pages), but we've also seen
                organization by domain (profile, billing, dashboard, etc). Being organized helps
                everyone use your Storybook more effectively.
              </p>
              <p>You can create a section like so:</p>
              <CodeSnippet language="typescript">
                {`// Button.stories.js

export default {
  component: Button,
-  title: 'Button', // You may not have this
+  title: 'Atoms/Button',
}`}
              </CodeSnippet>
              <p>Which would look like:</p>
              <img
                src={api.getDocsUrl({
                  asset: 'onboarding/sidebar-with-groups.png',
                  ref: 'guide',
                })}
                alt="Grouped components in the sidebar"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-stories/naming-components-and-hierarchy',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  story organization documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>The full hierarchy available</li>
                <li>How to configure the sorting of your stories</li>
              </ul>
            </>
          ),
        },
      ],
    },

    {
      id: 'testing',
      title: 'Testing',
      items: [
        {
          id: 'installVitest',
          label: 'Install Vitest addon',
          afterCompletion: 'unavailable',
          available: () =>
            !!globalThis.STORYBOOK_FRAMEWORK &&
            SUPPORTED_FRAMEWORKS.includes(globalThis.STORYBOOK_FRAMEWORK),
          criteria: '@storybook/addon-vitest registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes(ADDON_TEST_ID)) {
              done();
            }
          },
          content: ({ api }) => (
            <>
              <p>
                Run this command to install the Vitest addon, enabling you to run component tests on
                your stories inside Storybook’s UI:
              </p>
              <CodeSnippet language="bash">{`npx storybook add @storybook/addon-vitest`}</CodeSnippet>
              <p>
                <em>Restart your Storybook after installing the addon.</em>
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/testing-ui-overview.png',
                  ref: 'guide',
                })}
                alt="Storybook app with story status indicators, testing widget, and addon panel annotated"
              />
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/integrations/vitest-addon',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn more about the Vitest addon
                </Link>
              </p>
            </>
          ),
        },
        {
          id: 'runTests',
          after: ['installVitest'],
          label: 'Test your components',
          criteria: 'Component tests are run from the test widget in the sidebar',
          subscribe: ({ done }) =>
            internal_universalTestProviderStore.onStateChange(
              (state) => state['storybook/test'] === 'test-provider-state:succeeded' && done()
            ),
          action: {
            label: 'Start',
            onClick: () =>
              TourGuide.render({
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore Circular reference in Step type
                steps: [
                  {
                    title: 'Testing widget',
                    content:
                      'Run tests right from your Storybook sidebar using the testing widget.',
                    placement: 'right-end',
                    target: '#storybook-testing-module',
                    highlight: '#storybook-testing-module',
                    onNext: ({ next }: { next: () => void }) => {
                      const toggle = document.getElementById('testing-module-collapse-toggle');
                      if (toggle?.getAttribute('aria-label') === 'Expand testing module') {
                        toggle.click();
                        setTimeout(next, 300);
                      } else {
                        next();
                      }
                    },
                  },
                  {
                    title: 'Start a test run',
                    content: 'Start a test run at the click of a button using Vitest.',
                    placement: 'right',
                    target:
                      '[data-module-id="storybook/test/test-provider"] button[aria-label="Start test run"]',
                    highlight: `[data-module-id="storybook/test/test-provider"] button[aria-label="Start test run"]`,
                    hideNextButton: true,
                  },
                ],
              }),
          },
          content: ({ api }) => (
            <>
              <p>
                Stories make great test cases. You can quickly test all of your stories directly
                from the test widget, at the bottom of the sidebar.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'onboarding/test-widget-with-failures.png',
                  ref: 'guide',
                })}
                alt="Test widget showing test failures"
              />

              <p>
                Use the menu on a story or component to see details about a test failure or run
                tests for just that selection.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/context-menu.png',
                  ref: 'guide',
                })}
                alt="Screenshot of story sidebar item with open menu"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests#component-tests',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  component testing documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>About helpful features, like watch mode and sidebar filtering</li>
                <li>How to run tests via CLI and in CI</li>
                <li>
                  About other capabilities, like accessibility checks and code coverage reporting
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'writeInteractions',
          label: 'Test functionality with interactions',
          available: () => !!globalThis?.FEATURES?.interactions,
          criteria: 'At least one story with a play or test function',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(
              (entry) => entry.tags?.includes(Tag.PLAY_FN) || entry.tags?.includes(Tag.TEST_FN)
            )
          ),
          content: ({ api }) => (
            <>
              <p>
                When you need to test non-visual or particularly complex behavior of a component,
                add a play function.
              </p>
              <CodeSnippet language="typescript">
                {`// Button.stories.ts
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect, fn } from 'storybook/test';
 
import { Button } from './Button';
 
const meta = {
  component: Button,
  args: {
    // 👇 Provide a mock function to spy on
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;
 
export default meta;
type Story = StoryObj<typeof meta>;

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Button',
  },
  play: async function({ args, canvas, userEvent }) {
    const button = canvas.getByRole('button', { name: /button/i });
		
    // 👇 Simulate behavior
    await userEvent.click(button);
    
    // 👇 Make assertions
    await expect(button).toBeDisabled();
    await expect(args.onClick).not.toHaveBeenCalled();
  }
};`}
              </CodeSnippet>
              <p>
                You can interact with and debug each step defined in a play function within the
                Interactions panel.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/interaction-test-pass.png',
                  ref: 'guide',
                })}
                alt="Storybook with a LoginForm component and passing interactions in the Interactions panel"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/interaction-testing',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  interaction testing documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>
                  The full <code>play</code> function API
                </li>
                <li>How to run code before and after tests</li>
                <li>How to group interactions into steps</li>
              </ul>
            </>
          ),
        },
        {
          id: 'installA11y',
          label: 'Install Accessibility addon',
          afterCompletion: 'unavailable',
          criteria: '@storybook/addon-a11y registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes(ADDON_A11Y_ID)) {
              done();
            }
          },
          content: ({ api }) => (
            <>
              <p>
                Accessibility tests help ensure your UI is usable by everyone, no matter their
                ability.
              </p>
              <p>
                If you are not yet using the accessibility addon, run this command to install and
                set it up, enabling you to run accessibility checks alongside your component tests:
              </p>
              <CodeSnippet language="bash">{`npx storybook add @storybook/addon-a11y`}</CodeSnippet>
              <p>
                <em>Restart your Storybook after installing the addon.</em>
              </p>
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/accessibility-testing',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn more about the Accessibility addon
                </Link>
              </p>
            </>
          ),
        },
        {
          id: 'accessibilityTests',
          after: ['installA11y'],
          label: 'Run accessibility tests',
          criteria: 'Accessibility tests are run from the test widget in the sidebar',
          subscribe: ({ api, done }) =>
            api.on(
              STORYBOOK_ADDON_TEST_CHANNEL,
              ({ type, payload }) => type === 'test-run-completed' && payload.config.a11y && done()
            ),
          content: ({ api }) => (
            <>
              <p>
                Expand the test widget, check the Accessibility checkbox, and click the Run
                component tests button.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/test-widget-a11y-enabled.png',
                  ref: 'guide',
                })}
                alt="Testing widget with accessibility activated"
              />
              <p>
                If there are any failures, you can use the Accessibility panel to debug any
                violations.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/addon-a11y-debug-violations.png',
                  ref: 'guide',
                })}
                alt="Storybook app with accessibility panel open, showing violations and an interactive popover on the violating elements in the preview"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/accessibility-testing',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  accessibility testing documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>The recommended workflow</li>
                <li>How to run accessibility tests via CLI and in CI</li>
                <li>How to configure accessibility checks</li>
              </ul>
            </>
          ),
        },
        {
          id: 'installChromatic',
          label: 'Install Visual Tests addon',
          afterCompletion: 'unavailable',
          available: () => true, // TODO check for compatibility with the project (not React Native)
          criteria: '@chromatic-com/storybook registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes('chromaui/addon-visual-tests')) {
              done();
            }
          },
          content: ({ api }) => (
            <>
              <p>Visual tests verify the appearance of your UI components.</p>
              <p>
                If you are not yet using the visual tests addon, run this command to install and set
                it up, enabling you to run visual tests on your stories (this requires a free
                Chromatic account):
              </p>
              <CodeSnippet language="bash">{`npx storybook add @chromatic-com/storybook`}</CodeSnippet>
              <p>
                <em>Restart your Storybook after installing the addon.</em>
              </p>
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/visual-testing',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn more about the Visual Tests addon
                </Link>
              </p>
            </>
          ),
        },
        {
          id: 'visualTests',
          after: ['installChromatic'],
          label: 'Run visual tests',
          criteria:
            'Visual tests are run from the test widget in the sidebar or the Visual Tests panel',
          subscribe: ({ api, done }) => api.on('chromaui/addon-visual-tests/startBuild', done),
          content: ({ api }) => (
            <>
              <p>Expand the test widget and click the Run visual tests button.</p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/test-widget-expanded-with-vta.png',
                  ref: 'guide',
                })}
                alt="Expanded testing widget, showing the Visual tests section"
              />
              <p>
                You can use the Visual tests panel to verify the resulting diffs as either an
                unexpected change which needs fixed or an expected change which can then be accepted
                and become the new baseline.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/vta-run-from-panel.png',
                  ref: 'guide',
                })}
                alt="Visual tests addon panel showing a diff from the baseline"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/visual-testing',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  visual testing documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to automate your visual tests in CI</li>
              </ul>
            </>
          ),
        },
        {
          id: 'coverage',
          after: ['installVitest'],
          label: 'Generate a coverage report',
          criteria: 'Generate a coverage report',
          subscribe: ({ api, done }) =>
            api.on(
              STORYBOOK_ADDON_TEST_CHANNEL,
              ({ type, payload }) =>
                type === 'test-run-completed' && payload.config.coverage && done()
            ),
          content: ({ api }) => (
            <>
              <p>
                Coverage reports show you which code is&mdash;and, more importantly&mdash;isn&apos;t
                executed while running your component tests. You use it to be sure you&apos;re
                testing the right things.
              </p>
              <p>
                To generate a coverage report, expand the test widget in the sidebar and check the
                Coverage checkbox. The next time you run component tests, it will generate an
                interactive report, which you can view by clicking the results summary in the test
                widget.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/test-widget-coverage-summary.png',
                  ref: 'guide',
                })}
                alt="Test widget with coverage summary"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/test-coverage',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  test coverage documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to automate reporting in CI</li>
                <li>How to configure the coverage results</li>
              </ul>
            </>
          ),
        },
        {
          id: 'ciTests',
          label: 'Automate tests in CI',
          criteria: 'Have a CI workflow that runs component tests, either with Vitest or Chromatic',
          content: ({ api }) => (
            <>
              <p>
                Automating component tests in CI is the best tool ensuring the quality and
                reliability of your project.
              </p>
              <p>
                You can automate all of Storybook&apos;s tests by using Chromatic or by running the
                <code>vitest --project storybook</code> command in your CI scripts.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-tests/test-ci-workflow-pr-status-checks.png',
                  ref: 'guide',
                })}
                alt='GitHub pull request status checks, with a failing "UI Tests / test" check'
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-tests/in-ci',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  testing in CI documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to test in your CI platform (GitHub Actions, Circle CI, etc.)</li>
                <li>How to debug test failures in a published Storybook</li>
                <li>How to run your other Vitest tests alongside your Storybook tests</li>
              </ul>
            </>
          ),
        },
      ],
    },
    {
      id: 'document',
      title: 'Document',
      items: [
        {
          id: 'installDocs',
          label: 'Install Docs addon',
          afterCompletion: 'unavailable',
          criteria: '@storybook/addon-docs registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes(ADDON_DOCS_ID)) {
              done();
            }
          },
          content: ({ api }) => (
            <>
              <p>
                Storybook Docs transforms your Storybook stories into component documentation. Add
                the Docs addon to your Storybook project to get started:
              </p>
              <CodeSnippet language="bash">{`npx storybook add @storybook/addon-docs`}</CodeSnippet>
              <p>
                <em>Restart your Storybook after installing the addon.</em>
              </p>
              <p>
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-docs',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                  withArrow
                >
                  Learn more about Storybook Docs
                </Link>
              </p>
            </>
          ),
        },
        {
          id: 'autodocs',
          after: ['installDocs'],
          label: 'Automatically document your components',
          criteria: 'At least one component with the autodocs tag applied',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some((entry) => entry.tags?.includes(Tag.AUTODOCS))
          ),
          content: ({ api }) => (
            <>
              <p>
                Add the autodocs tag to a component&apos;s meta to automatically generate
                documentation for that component, complete with examples, source code, an API table,
                and a description.
              </p>
              <CodeSnippet language="typescript">
                {`// Button.stories.js

const meta = {
  component: Button,
  tags: ['autodocs'], // 👈 Add this tag
}
  
export default meta;`}
              </CodeSnippet>
              <p>
                That tag can also be applied in <code>.storybook/preview.ts</code>, to generate
                documentation for <em>all</em> components.
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'writing-docs/autodocs.png',
                  ref: 'guide',
                })}
                alt="Storybook autodocs page, showing a title, description, primary story, controls table, and additional stories"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-docs/autodocs',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  autodocs documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to generate a table of contents</li>
                <li>How to enhance your component documentation with JSDoc comments</li>
                <li>How to customize the generated page</li>
              </ul>
            </>
          ),
        },
        {
          id: 'mdxDocs',
          after: ['installDocs'],
          label: 'Custom content with MDX',
          criteria: 'At least one MDX page',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some((entry) => entry.type === 'docs')
          ),
          content: ({ api }) => (
            <>
              <p>
                You can use MDX (markdown + React components) to provide an introduction to your
                project, document things like design tokens, or go beyond the automatic
                documentation for your components.
              </p>
              <p>
                For a start, create an <code>introduction.mdx</code> file and (using markdown and
                Storybook&apos;s{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-docs/doc-blocks',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  doc blocks
                </Link>
                ) write a usage guide for your project.
              </p>
              <CodeSnippet language="jsx">
                {`{ /* introduction.mdx */ }
import { Meta, Title, Subtitle, Description } from '@storybook/addon-docs/blocks';

<Meta title="Get started" />
 
<Title>Get started with My Awesome Project</Title>

<Subtitle>It's really awesome</Subtitle>

<Description>
  My Awesome Project is designed to work with Your Awesome Project seamlessly.
  Follow this guide and you'll be ready in no time.
</Description>

## Install

\`\`\`sh
npm install @my/awesome-project
\`\`\``}
              </CodeSnippet>
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'writing-docs/mdx',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  MDX documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to reference stories in your content</li>
                <li>How to import and display markdown files, such as READMEs</li>
              </ul>
            </>
          ),
        },
        {
          id: 'publishStorybook',
          label: 'Publish your Storybook to share',
          criteria: "Have some form of `storybook build` in the project's CI config",
          content: ({ api }) => (
            <>
              <p>
                Publishing your Storybook is easy and unlocks super clear review cycles and other
                collaborative workflows.
              </p>
              <p>
                Run <code>npx storybook build</code> in CI and deploy it using services like{' '}
                <Link href="https://chromatic.com" target="_blank">
                  Chromatic
                </Link>
                ,{' '}
                <Link href="https://vercel.com" target="_blank" rel="noopener noreferrer">
                  Vercel
                </Link>
                , or{' '}
                <Link href="https://www.netlify.com" target="_blank" rel="noopener noreferrer">
                  Netlify
                </Link>
                .
              </p>
              <img
                src={api.getDocsUrl({
                  asset: 'sharing/prbadge-publish.png',
                  ref: 'guide',
                })}
                alt="PR check for publish action"
              />
              <strong>Take it further</strong>
              <p>
                Read the{' '}
                <Link
                  href={api.getDocsUrl({
                    subpath: 'sharing/publish-storybook',
                    renderer: true,
                    ref: 'guide',
                  })}
                  target="_blank"
                >
                  publishing documentation
                </Link>{' '}
                to learn:
              </p>
              <ul>
                <li>How to configure the built Storybook (e.g. performance optimizations)</li>
                <li>How to use your published Storybook to collaborate with colleagues</li>
              </ul>
            </>
          ),
        },
      ],
    },
  ],
} as const satisfies ChecklistData;
