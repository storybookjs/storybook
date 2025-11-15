import type { ComponentProps } from 'react';
import React from 'react';

import { Link, SyntaxHighlighter } from 'storybook/internal/components';
import {
  STORY_ARGS_UPDATED,
  STORY_FINISHED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type {
  API_IndexHash,
  API_PreparedIndexEntry,
  API_StoryEntry,
} from 'storybook/internal/types';

import { type API, addons, internal_universalTestProviderStore } from 'storybook/manager-api';
import { ThemeProvider, convert, styled, themes } from 'storybook/theming';

import { TourGuide } from '../../components/TourGuide/TourGuide';

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

export interface ChecklistData {
  sections: {
    id: string;
    title: string;
    items: {
      // Unique identifier for persistence. Update when making significant changes.
      id: string;

      // Display name. Keep it short and actionable (with a verb).
      label: string;

      // Description of the criteria that must be met to complete the item.
      criteria: string;

      // Items that must be completed before this item can be completed (locked until then).
      after?: string[];

      // What to do after the item is completed (prevent undo or hide the item).
      afterCompletion?: 'immutable' | 'unavailable';

      // Function to check if the item should be available (displayed in the checklist).
      // Called any time the index is updated.
      available?: (args: {
        api: API;
        index: API_IndexHash | undefined;
        item: ChecklistData['sections'][number]['items'][number];
      }) => boolean;

      // Function returning content to display in the checklist item's collapsible area.
      content?: () => React.ReactNode;

      // Action button to be displayed when item is not completed.
      action?: {
        label: string;
        onClick: (args: { api: API; accept: () => void }) => void;
      };

      // Function to subscribe to events and update the item's state.
      // May return a function to unsubscribe once the item is completed.
      subscribe?: (args: {
        api: API;
        item: ChecklistData['sections'][number]['items'][number];

        // Call this to complete the item and persist to user-local storage.
        // This is preferred when dealing with user-specific criteria (e.g. learning goals).
        accept: () => void;

        // Call this to complete the item and persist to project-local storage.
        // This is preferred when dealing with project-specific criteria (e.g. component count).
        done: () => void;

        // Call this to skip the item and persist to user-local storage.
        skip: () => void;
      }) => void | (() => void);
    }[];
  }[];
}

const subscribeToIndex: (
  condition: (entries: Record<string, API_PreparedIndexEntry>) => boolean
) => ChecklistData['sections'][number]['items'][number]['subscribe'] =
  (condition) =>
  ({ api, done }) => {
    const check = () => condition(api.getIndex()?.entries || {});
    if (check()) {
      done();
    } else {
      return api.on(STORY_INDEX_INVALIDATED, () => check() && done());
    }
  };

export const checklistData: ChecklistData = {
  sections: [
    {
      id: 'basics',
      title: 'Storybook basics',
      items: [
        {
          id: 'guided-tour',
          label: 'Take the guided tour',
          available: ({ index }) => !!index && 'example-button--primary' in index,
          criteria: 'Guided tour is completed',
          subscribe: ({ api, accept }) =>
            api.on('STORYBOOK_ADDON_ONBOARDING_CHANNEL', ({ step, type }) => {
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
          id: 'onboarding-survey',
          label: 'Complete the onboarding survey',
          available: ({ index }) => !!index && 'example-button--primary' in index,
          afterCompletion: 'immutable',
          criteria: 'Onboarding survey is completed',
          subscribe: ({ api, accept }) =>
            api.on(
              'STORYBOOK_ADDON_ONBOARDING_CHANNEL',
              ({ type }) => type === 'survey' && accept()
            ),
          action: {
            label: 'Open',
            onClick: ({ api }) => {
              const path = api.getUrlState().path || '';
              document.location.href = `/?path=${path}&onboarding=survey`;
            },
          },
        },
        {
          id: 'whats-new-storybook-10',
          label: "See what's new",
          criteria: "What's New page is opened",
          action: {
            label: 'Go',
            onClick: ({ api, accept }) => {
              api.navigate('/settings/whats-new');
              accept();
            },
          },
        },
        {
          id: 'render-component',
          label: 'Render a component',
          criteria: 'A story finished rendering successfully',
          subscribe: ({ api, done }) =>
            api.on(STORY_FINISHED, ({ status }) => status === 'success' && done()),
          content: () => (
            <>
              <p>
                A story captures the rendered state of a UI component. It's an object with
                annotations that describe the component's behavior and appearance given a set of
                arguments.
              </p>
              <p>
                Storybook uses the generic term arguments (args for short) when talking about
                React's props, Vue's props, Angular's @Input, and other similar concepts.
              </p>
              <p>
                We define stories according to the Component Story Format (CSF), an ES6 module-based
                standard that is easy to write and portable between tools.
              </p>
            </>
          ),
        },
        {
          id: 'more-components',
          after: ['render-component'],
          label: 'Add 5 components',
          content: () => (
            <p>
              Storybook gets better as you add more components. Start with the easy ones, like
              Button or Avatar, and work your way up to more complex components, like Select,
              Autocomplete, or even full pages.
            </p>
          ),
          criteria: 'At least 5 components exist in the index',
          subscribe: subscribeToIndex((entries) => {
            const stories = Object.values(entries).filter(
              (entry): entry is API_StoryEntry =>
                entry.type === 'story' && !entry.id.startsWith('example-')
            );
            const components = new Set(stories.map(({ title }) => title));
            return components.size >= 5;
          }),
        },
        {
          id: 'more-stories',
          after: ['render-component'],
          label: 'Add 20 stories',
          content: () => (
            <p>
              More stories for your components means better documentation and more test coverage.
            </p>
          ),
          criteria: 'At least 20 stories exist in the index',
          subscribe: subscribeToIndex((entries) => {
            const stories = Object.values(entries).filter(
              (entry): entry is API_StoryEntry =>
                entry.type === 'story' && !entry.id.startsWith('example-')
            );
            return stories.length >= 20;
          }),
        },
      ],
    },

    {
      id: 'development',
      title: 'Development',
      items: [
        {
          id: 'controls',
          after: ['render-component'],
          label: 'Update a story with Controls',
          criteria: 'Story args are updated',
          subscribe: ({ api, done }) => api.on(STORY_ARGS_UPDATED, done),
          content: () => (
            <p>
              When you change the value of one of the inputs in the Controls table, the story
              automatically updates to reflect that change. It&apos;s a great way to explore how a
              component handles various inputs.
            </p>
          ),
        },
        {
          id: 'viewports',
          after: ['render-component'],
          label: 'Check responsiveness with Viewports',
          criteria: 'Viewport global is updated',
          subscribe: ({ api, done }) =>
            api.on(UPDATE_GLOBALS, ({ globals }) => globals?.viewport && done()),
          content: () => (
            <>
              <p>
                Many UI components need to be responsive to the viewport size. Storybook has
                built-in support for previewing stories in various device sizes.
              </p>
              <Link
                href="https://storybook.js.org/docs/essentials/viewport#defining-the-viewport-for-a-story"
                target="_blank"
                withArrow
              >
                Learn more
              </Link>
            </>
          ),
        },
        {
          id: 'organize-stories',
          after: ['render-component'],
          label: 'Get organized',
          criteria: 'A root node exists in the index',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(({ title }) => title.includes('/'))
          ),
          content: () => (
            <>
              <p>
                It&apos;s helpful for projects to organize their sidebar into groups. We&apos;re big
                fans of Atomic Design (atoms, molecules, organisms, pages), but we've also seen
                organization by domain (profile, billing, dashboard, etc). Being organized helps
                everyone use your Storybook more effectively.
              </p>
              <p>You can create a section like so:</p>
              <CodeSnippet language="jsx">
                {`// Button.stories.js

export default {
  component: Button,
-  title: 'Button', // You may not have this
+  title: 'Atoms/Button',
}`}
              </CodeSnippet>
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
          id: 'install-vitest',
          label: 'Install Vitest addon',
          afterCompletion: 'unavailable',
          available: () => true, // TODO check for compatibility with the project
          criteria: '@storybook/addon-vitest registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes('storybook/test')) {
              done();
            }
          },
          content: () => (
            <>
              <p>
                More stories for your components means better documentation and more test coverage.
                Add the Vitest addon to your Storybook project to get started:
              </p>
              <CodeSnippet language="bash">{`npx storybook add @storybook/addon-vitest`}</CodeSnippet>
              <p>Restart your Storybook after installing the addon.</p>
            </>
          ),
        },
        {
          id: 'run-tests',
          after: ['install-vitest'],
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
          content: () => (
            <>
              <p>
                Stories make great test cases. You can quickly test all of your stories directly
                from the test widget, at the bottom of the sidebar.
              </p>
              <p>
                Use the menu on a story or component to see details about a test failure or run
                tests for just that selection.
              </p>
              <Link
                href="https://storybook.js.org/docs/writing-tests/interaction-testing#running-interaction-tests"
                target="_blank"
                withArrow
              >
                Learn more
              </Link>
            </>
          ),
        },
        {
          id: 'write-interactions',
          after: ['render-component'],
          label: 'Test functionality with interactions',
          criteria: 'At least one story with a play or test function',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(
              ({ id, tags }) =>
                !id.startsWith('example-') &&
                (tags?.includes('play-fn') || tags?.includes('test-fn'))
            )
          ),
          content: () => (
            <>
              <p>
                When you need to test non-visual or particularly complex behavior of a component,
                add a play function.
              </p>
              <CodeSnippet language="jsx">
                {`// Button.stories.js

async play({ canvas, userEvent }) {
  // Simulate behavior and make assertions
}`}
              </CodeSnippet>
              <p>
                You can interact with and debug each step defined in a play function within the
                Interactions panel.
              </p>
              <Link
                href="https://storybook.js.org/docs/writing-stories/play-function"
                target="_blank"
                withArrow
              >
                Learn more
              </Link>
            </>
          ),
        },
        {
          id: 'install-a11y',
          label: 'Install Accessibility addon',
          afterCompletion: 'unavailable',
          criteria: '@storybook/addon-a11y registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes('storybook/a11y')) {
              done();
            }
          },
          content: () => (
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
              <p>Restart your Storybook after installing the addon.</p>
            </>
          ),
        },
        {
          id: 'accessibility-tests',
          after: ['install-a11y'],
          label: 'Run accessibility tests',
          criteria: 'Accessibility tests are run from the test widget in the sidebar',
          subscribe: ({ api, done }) => api.on('storybook/a11y/result', done), // TODO check test widget state
          content: () => (
            <>
              <p>
                Expand the test widget, check the Accessibility checkbox, and click the Run
                component tests button.
              </p>
              <Link
                href="https://storybook.js.org/docs/writing-tests/accessibility-testing#run-accessibility-tests"
                target="_blank"
                withArrow
              >
                Learn more
              </Link>
            </>
          ),
        },
        {
          id: 'install-chromatic',
          label: 'Install Visual Tests addon',
          afterCompletion: 'unavailable',
          available: () => true, // TODO check for compatibility with the project (not React Native)
          criteria: '@chromatic-com/storybook registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes('chromaui/addon-visual-tests')) {
              done();
            }
          },
          content: () => (
            <>
              <p>Visual tests verify the appearance of your UI components.</p>
              <p>
                If you are not yet using the visual tests addon, run this command to install and set
                it up, enabling you to run visual tests on your stories (this requires a free
                Chromatic account):
              </p>
              <CodeSnippet language="bash">{`npx storybook add @chromatic-com/storybook`}</CodeSnippet>
              <p>Restart your Storybook after installing the addon.</p>
            </>
          ),
        },
        {
          id: 'visual-tests',
          after: ['install-chromatic'],
          label: 'Run visual tests',
          criteria:
            'Visual tests are run from the test widget in the sidebar or the Visual Tests panel',
          subscribe: ({ api, done }) => api.on('chromaui/addon-visual-tests/startBuild', done),
          content: () => (
            <>
              <p>Expand the test widget and click the Run visual tests button.</p>
              <Link
                href="https://storybook.js.org/docs/writing-tests/visual-testing"
                target="_blank"
                withArrow
              >
                Learn more
              </Link>
            </>
          ),
        },
        {
          id: 'coverage',
          after: ['install-vitest'],
          label: 'Generate a coverage report',
          criteria: 'Generate and view a coverage report',
          content: () => (
            <>
              <p>
                Coverage reports show you which code is &mdash; and, more importantly &mdash;
                isn&apos;t executed while running your component tests. You use it to be sure
                you&apos;re testing the right things.
              </p>
              <p>
                To generate a coverage report, expand the test widget in the sidebar and check the
                Coverage checkbox. The next time you run component tests, it will generate an
                interactive report, which you can view by clicking the results summary in the test
                widget.
              </p>
            </>
          ),
        },
        {
          id: 'ci-tests',
          label: 'Automate tests in CI',
          criteria: 'Have a CI workflow that runs component tests, either with Vitest or Chromatic',
          content: () => (
            <>
              <p>
                Automating component tests in CI is the best tool ensuring the quality and
                reliability of your project.
              </p>
              <p>
                You can automate all of Storybook&apos;s tests by using Chromatic or by running the
                <code>vitest --project storybook</code> command in your CI scripts.
              </p>
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
          id: 'install-docs',
          label: 'Install Docs addon',
          afterCompletion: 'unavailable',
          criteria: '@storybook/addon-docs registered in .storybook/main.js|ts',
          subscribe: ({ done }) => {
            if (addons.experimental_getRegisteredAddons().includes('storybook/docs')) {
              done();
            }
          },
          content: () => (
            <>
              <p>
                Storybook Docs transforms your Storybook stories into component documentation. Add
                the Docs addon to your Storybook project to get started:
              </p>
              <CodeSnippet language="bash">{`npx storybook add @storybook/addon-docs`}</CodeSnippet>
              <p>Restart your Storybook after installing the addon.</p>
            </>
          ),
        },
        {
          id: 'autodocs',
          after: ['install-docs'],
          label: 'Automatically document your components',
          criteria: 'At least one component with the autodocs tag applied',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(
              ({ id, tags }) => !id.startsWith('example-') && tags?.includes('autodocs')
            )
          ),
          content: () => (
            <>
              <p>
                Add the autodocs tag to a component&apos;s meta to automatically generate
                documentation for that component, complete with examples, source code, an API table,
                and a description.
              </p>
              <CodeSnippet language="jsx">
                {`// Button.stories.js

export default {
  component: Button,
  tags: ['autodocs'], // 👈 Add this tag
}`}
              </CodeSnippet>
              <p>
                That tag can also be applied in <code>.storybook/preview.js</code>, to generate
                documentation for all components.
              </p>
            </>
          ),
        },
        {
          id: 'mdx-docs',
          after: ['install-docs'],
          label: 'Custom content with MDX',
          criteria: 'At least one MDX page',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(
              ({ id, type }) => type === 'docs' && !id.startsWith('example-')
            )
          ),
          content: () => (
            <>
              <p>
                You can use MDX (markdown + React components) to provide an introduction to your
                project, document things like design tokens, or go beyond the automatic
                documentation for your components.
              </p>
              <p>
                For a start, create an introduction.mdx file and (using markdown and
                Storybook&apos;s doc blocks) write a usage guide for your project.
              </p>
            </>
          ),
        },
        {
          id: 'publish-storybook',
          label: 'Publish your Storybook to share',
          criteria: "Have some form of `storybook build` in the project's CI config",
          content: () => (
            <>
              <p>
                Publishing your Storybook is easy and unlocks super clear review cycles and other
                collaborative workflows.
              </p>
              <p>
                Run <code>npx storybook build</code> in CI and deploy it using services like
                Chromatic, Vercel, or Netlify.
              </p>
              <h4>Take it further</h4>
              <p>
                Read the{' '}
                <Link
                  href="https://storybook.js.org/docs/sharing/publish-storybook"
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
};
