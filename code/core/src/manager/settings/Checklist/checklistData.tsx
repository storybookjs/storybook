import React from 'react';

import { Link } from 'storybook/internal/components';

import type { ChecklistData } from './Checklist';

export const checklistData: ChecklistData = {
  sections: [
    {
      id: 'build',
      title: 'Build',
      items: [
        {
          id: 'whats-new-sb-9',
          label: "See what's new",
          action: {
            label: 'Start',
            onClick: ({ api }) => api.navigate('/settings/whats-new'),
          },
        },
        {
          id: 'add-component',
          label: 'Add component',
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
          // predicate: ({ complete }) => complete(),
        },
        {
          id: 'add-5-10-components',
          after: ['add-component'],
          label: 'Add 5-10 total components',
          content: (
            <>
              A story is an object that describes how to render a component. You can have multiple
              stories per component, and those stories can build upon one another. For example, we
              can add Secondary and Tertiary stories based on our Primary story from above.
            </>
          ),
          predicate: ({ complete }) => complete(),
        },
        {
          id: 'check-improve-coverage',
          after: ['add-component'],
          label: 'Check + improve coverage',
          content: (
            <>
              <p>
                Test coverage is the practice of measuring whether existing tests fully cover your
                code. It marks which conditions, logic branches, functions and variables in your
                code are and are not being tested.
              </p>
              <p>
                Coverage tests examine the instrumented code against a set of industry-accepted best
                practices. They act as the last line of QA to improve the quality of your test
                suite.
              </p>
            </>
          ),
          predicate: ({ complete }) => setTimeout(complete, 3000),
        },
      ],
    },
    {
      id: 'test',
      title: 'Test',
      items: [
        {
          id: 'run-tests',
          after: ['add-component'],
          label: 'Run tests',
          predicate: ({ complete }) => complete(),
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
          after: ['add-component'],
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
          after: ['add-component'],
          label: 'Accessibility tests',
          predicate: ({ complete }) => complete(),
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
          after: ['add-component'],
          label: 'Visual tests',
          predicate: ({ complete }) => complete(),
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
        {
          id: 'viewports',
          after: ['add-component'],
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
        },
      ],
    },
    {
      id: 'document',
      title: 'Document',
      items: [
        {
          id: 'controls',
          after: ['add-component'],
          label: 'Controls',
          content: (
            <>
              Storybook Controls gives you a graphical UI to interact with a component's arguments
              dynamically without needing to code. Use the Controls panel to edit the inputs to your
              stories and see the results in real-time. It's a great way to explore your components
              and test different states.
            </>
          ),
        },
        {
          id: 'autodocs',
          after: ['add-component'],
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
          id: 'share-story',
          after: ['add-component'],
          label: 'Share story',
          content: (
            <>
              Teams publish Storybook online to review and collaborate on works in progress. That
              allows developers, designers, PMs, and other stakeholders to check if the UI looks
              right without touching code or requiring a local dev environment.
            </>
          ),
        },
      ],
    },
  ],
};
