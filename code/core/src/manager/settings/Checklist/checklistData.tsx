import React from 'react';

import { Link } from 'storybook/internal/components';
import {
  STORY_ARGS_UPDATED,
  STORY_FINISHED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type { API_IndexHash } from 'storybook/internal/types';

import { type API } from 'storybook/manager-api';

export interface ChecklistData {
  sections: {
    id: string;
    title: string;
    items: {
      id: string;
      label: string;
      after?: string[];
      content?: React.ReactNode;
      action?: {
        label: string;
        onClick: (args: { api: API; accept: () => void }) => void;
      };
      subscribe?: (args: {
        api: API;
        index: API_IndexHash;
        item: ChecklistData['sections'][number]['items'][number];
        done: () => void;
        skip: () => void;
      }) => void | (() => void);
    }[];
  }[];
}

export const checklistData: ChecklistData = {
  sections: [
    {
      id: 'basics',
      title: 'Storybook basics',
      items: [
        {
          id: 'install-storybook',
          label: 'Install Storybook',
          subscribe: ({ done }) => done(),
        },
        {
          id: 'whats-new-storybook-10',
          label: "See what's new",
          action: {
            label: 'Start',
            onClick: ({ api, accept }) => {
              api.navigate('/settings/whats-new');
              accept();
            },
          },
        },
        {
          id: 'first-story',
          label: 'Create first story',
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
          subscribe: ({ api, done }) =>
            api.on(STORY_FINISHED, ({ status }) => status === 'success' && done()),
        },
        {
          id: 'more-components',
          after: ['first-story'],
          label: 'Add 5 components',
          content: (
            <p>
              A story is an object that describes how to render a component. You can have multiple
              stories per component, and those stories can build upon one another. For example, we
              can add Secondary and Tertiary stories based on our Primary story from above.
            </p>
          ),
          subscribe: ({ api, done }) => {
            const check = () => {
              const entries = api.getIndex()?.entries || {};
              const stories = Object.values(entries).filter(({ type }) => type === 'story');
              const components = new Set(stories.map(({ title }) => title));
              return components.size >= 5;
            };
            if (check()) {
              done();
            } else {
              return api.on(STORY_INDEX_INVALIDATED, () => check() && done());
            }
          },
        },
        {
          id: 'more-stories',
          after: ['first-story'],
          label: 'Add 20 stories',
          content: (
            <p>
              A story is an object that describes how to render a component. You can have multiple
              stories per component, and those stories can build upon one another. For example, we
              can add Secondary and Tertiary stories based on our Primary story from above.
            </p>
          ),
          subscribe: ({ api, done }) => {
            const check = () => {
              const entries = api.getIndex()?.entries || {};
              const stories = Object.values(entries).filter(({ type }) => type === 'story');
              return stories.length >= 20;
            };
            if (check()) {
              done();
            } else {
              return api.on(STORY_INDEX_INVALIDATED, () => check() && done());
            }
          },
        },
      ],
    },
    {
      id: 'development',
      title: 'Development',
      items: [
        {
          id: 'controls',
          after: ['first-story'],
          label: 'Controls',
          content: (
            <>
              Storybook Controls gives you a graphical UI to interact with a component's arguments
              dynamically without needing to code. Use the Controls panel to edit the inputs to your
              stories and see the results in real-time. It's a great way to explore your components
              and test different states.
            </>
          ),
          subscribe: ({ api, done }) => api.on(STORY_ARGS_UPDATED, done),
        },
        {
          id: 'viewports',
          after: ['first-story'],
          label: 'Viewports',
          content: (
            <>
              <p>
                The viewport feature allows you to adjust the dimensions of the iframe your story is
                rendered in. It makes it easy to develop responsive UIs. The Viewport module enables
                you to change the viewport applied to a story by selecting from the list of
                predefined viewports in the toolbar. If needed, you can set a story to default to a
                specific viewport by using the globals option.
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
          subscribe: ({ api, done }) =>
            api.on(UPDATE_GLOBALS, ({ globals }) => globals?.viewport && done()),
        },
        {
          id: 'organize-stories',
          after: ['first-story'],
          label: 'Organize your stories',
        },
      ],
    },
    {
      id: 'testing',
      title: 'Testing',
      items: [
        {
          id: 'install-vitest',
          label: 'Install Vitest',
          subscribe: ({ done }) => done(),
          content: (
            <p>
              Storybook offers fast, powerful testing from the sidebar, with the Vitest addon. It
              transforms your stories into real Vitest tests, and then runs them in the background,
              via Vitest and Playwright. Results are displayed in your sidebar, and you can debug
              failures with all your favorite features and addons, in addition to the browser dev
              tools.
            </p>
          ),
        },
        {
          id: 'run-tests',
          after: ['first-story'],
          label: 'Run tests',
          // subscribe: ({ done }) => done(),
          content: (
            <>
              <p>
                In the Storybook UI, you can run interaction tests by clicking the{' '}
                <b>Run component tests</b> button in the expanded testing widget in the sidebar or
                by opening the context menu (three dots) on a story or folder and selecting{' '}
                <b>Run component tests</b>.
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
          after: ['first-story'],
          label: 'Write interactions',
          content: (
            <>
              <p>
                Play functions are small snippets of code executed after the story renders. They
                enable you to interact with your components and test scenarios that otherwise
                require user intervention.
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
          after: ['first-story'],
          label: 'Accessibility tests',
          subscribe: ({ done }) => done(),
          content: (
            <>
              <p>
                To run accessibility tests in the Storybook UI, first expand the testing widget in
                the sidebar and check the Accessibility checkbox. Now, when you press the Run
                component tests button, the accessibility tests will be run along with any other
                tests you have configured.
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
          after: ['first-story'],
          label: 'Visual tests',
          // subscribe: ({ done }) => done(),
          content: (
            <>
              <p>
                Visual tests are the most efficient way to test your components. With the click of a
                button you can take snapshots of every story in your Storybook and compare those
                snapshots to baselines — last known “good” snapshots. Not only does this allow you
                to check the appearance of your components, but they are also able to check a large
                subset of component functionality without having to write or maintain any test code!
              </p>
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
      ],
    },
    {
      id: 'document',
      title: 'Document',
      items: [
        {
          id: 'autodocs',
          after: ['first-story'],
          label: 'Autodocs',
          content: (
            <>
              Storybook Autodocs is a powerful tool that can help you quickly generate comprehensive
              documentation for your UI components. By leveraging Autodocs, you're transforming your
              stories into living documentation which can be further extended with MDX and Doc
              Blocks to provide a clear and concise understanding of your components' functionality.
            </>
          ),
        },
        {
          id: 'mdx',
          after: ['first-story'],
          label: 'Write MDX documentation',
          content: (
            <>
              MDX files mix Markdown and Javascript/JSX to create rich interactive documentation.
              You can use Markdown&apos;s readable syntax (such as `# heading`) for your
              documentation, include stories defined in Component Story Format (CSF), and freely
              embed JSX component blocks at any point in the file. All at once.
            </>
          ),
        },
      ],
    },
  ],
};
