import React from 'react';

import { Link } from 'storybook/internal/components';
import {
  STORY_ARGS_UPDATED,
  STORY_FINISHED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type { API_IndexHash, API_PreparedIndexEntry } from 'storybook/internal/types';

import { type API } from 'storybook/manager-api';

export interface ChecklistData {
  sections: {
    id: string;
    title: string;
    items: {
      id: string;
      label: string;
      criteria: string;
      after?: string[];
      available?: (args: { api: API }) => boolean;
      content?: React.ReactNode;
      action?: {
        label: string;
        onClick: (args: { api: API; accept: () => void }) => void;
      };
      subscribe?: (args: {
        api: API;
        index: API_IndexHash;
        item: ChecklistData['sections'][number]['items'][number];
        accept: () => void;
        done: () => void;
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
    // TODO exclude sample stories
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
          id: 'install-storybook',
          label: 'Install Storybook',
          criteria: 'Storybook is installed',
          subscribe: ({ done }) => done(),
        },
        {
          id: 'whats-new-storybook-10',
          label: "See what's new",
          criteria: "What's New page is opened",
          action: {
            label: 'Start',
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
          content: (
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
          content: (
            <p>
              Storybook gets better as you add more components. Start with the easy ones, like
              Button or Avatar, and work your way up to more complex components, like Select,
              Autocomplete, or even full pages.
            </p>
          ),
          criteria: 'At least 5 components exist in the index',
          subscribe: subscribeToIndex((entries) => {
            const stories = Object.values(entries).filter(({ type }) => type === 'story');
            const components = new Set(stories.map(({ title }) => title));
            return components.size >= 5;
          }),
        },
        {
          id: 'more-stories',
          after: ['render-component'],
          label: 'Add 20 stories',
          content: (
            <p>
              More stories for your components means better documentation and more test coverage.
            </p>
          ),
          criteria: 'At least 20 stories exist in the index',
          subscribe: subscribeToIndex((entries) => {
            const stories = Object.values(entries).filter(({ type }) => type === 'story');
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
          content: (
            <p>
              Storybook gets better as you add more components. Start with the easy ones, like
              Button or Avatar, and work your way up to more complex components, like Select,
              Autocomplete, or even full pages.
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
          content: (
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
          content: (
            <>
              <p>
                It&apos;s helpful for projects to organize their sidebar into groups. We&apos;re big
                fans of Atomic Design (atoms, molecules, organisms, pages), but we've also seen
                organization by domain (profile, billing, dashboard, etc). Being organized helps
                everyone use your Storybook more effectively.
              </p>
              <p>You can create a section like so:</p>
              <code>
                <pre>
                  {`// Button.stories.js

export default {
  component: Button,
-  title: 'Button', // You may not have this
+  title: 'Atoms/Button',
}`}
                </pre>
              </code>
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
          criteria: '@storybook/addon-vitest registered in .storybook/main.js|ts',
          subscribe: ({ done }) => done(),
          content: (
            <p>
              More stories for your components means better documentation and more test coverage.
            </p>
          ),
        },
        {
          id: 'run-tests',
          after: ['render-component'],
          label: 'Test your components',
          criteria: 'Component tests are run from the test widget in the sidebar',
          content: (
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
              ({ tags }) => tags?.includes('play-fn') || tags?.includes('test-fn')
            )
          ),
          content: (
            <>
              <p>
                When you need to test non-visual or particularly complex behavior of a component,
                add a play function.
              </p>
              <code>
                <pre>
                  {`// Button.stories.js

async play({ canvas, userEvent }) {
	// Simulate behavior
	
	// Make assertions
}`}
                </pre>
              </code>
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
          id: 'accessibility-tests',
          after: ['render-component'],
          label: 'Run accessibility tests',
          criteria: 'Accessibility tests are run from the test widget in the sidebar',
          subscribe: ({ api, done }) => api.on('storybook/a11y/result', done), // TODO check test widget state
          content: (
            <>
              <p>
                Accessibility tests help ensure your UI is usable by everyone, no matter their
                ability.
              </p>
              <p>
                If you are not yet using the accessibility addon, run this command to install and
                set it up, enabling you to run accessibility checks alongside your component tests:
              </p>
              <code>
                <pre>{`npx storybook add @storybook/addon-a11y`}</pre>
              </code>
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
          id: 'visual-tests',
          after: ['render-component'],
          label: 'Run visual tests',
          criteria:
            'Visual tests are run from the test widget in the sidebar or the Visual Tests panel',
          subscribe: ({ api, done }) => api.on('chromaui/addon-visual-tests/startBuild', done),
          content: (
            <>
              <p>Visual tests verify the appearance of your UI components.</p>
              <p>
                If you are not yet using the visual tests addon, run this command to install and set
                it up, enabling you to run visual tests on your stories (this requires a free
                Chromatic account):
              </p>
              <code>
                <pre>{`npx storybook add @chromatic-com/storybook`}</pre>
              </code>
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
          after: ['render-component'],
          label: 'Generate a coverage report',
          criteria: 'Generate and view a coverage report',
          content: (
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
          after: ['render-component'],
          label: 'Automate tests in CI',
          criteria: 'Have a CI workflow that runs component tests, either with Vitest or Chromatic',
          content: (
            <>
              <p>
                Automating component tests in CI is the best tool ensuring the quality and
                reliability of your project.
              </p>
              <p>
                You can automate all of Storybook&apos;s tests by using Chromatic or by running the
                <pre>vitest --project storybook</pre> command in your CI scripts.
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
          id: 'autodocs',
          after: ['render-component'],
          label: 'Automatically document your components',
          criteria: 'At least one component with the autodocs tag applied',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(({ tags }) => tags?.includes('autodocs'))
          ),
          content: (
            <>
              <p>
                Add the autodocs tag to a component&apos;s meta to automatically generate
                documentation for that component, complete with examples, source code, an API table,
                and a description.
              </p>
              <code>
                <pre>
                  {`// Button.stories.js

export default {
  component: Button,
  tags: ['autodocs'], // 👈 Add this tag
}`}
                </pre>
              </code>
              <p>
                That tag can also be applied in <pre>.storybook/preview.js</pre>, to generate
                documentation for all components.
              </p>
            </>
          ),
          // Criteria: At least one component with the autodocs tag applied
        },
        {
          id: 'mdx-docs',
          after: ['render-component'],
          label: 'Custom content with MDX',
          criteria: 'At least one MDX page',
          subscribe: subscribeToIndex((entries) =>
            Object.values(entries).some(({ type }) => type === 'docs')
          ),
          content: (
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
          after: ['render-component'],
          label: 'Publish your Storybook to share',
          criteria: 'Some form of `storybook --build` in the project source',
          content: (
            <>
              <p>
                Publishing your Storybook is easy and unlocks super clear review cycles and other
                collaborative workflows.
              </p>
              <p>
                Run <pre>storybook --build</pre> in CI and deploy it using services like Chromatic,
                Vercel, or Netlify.
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
