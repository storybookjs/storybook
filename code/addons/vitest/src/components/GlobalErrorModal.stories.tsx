import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import { dedent } from 'ts-dedent';

import { storeOptions } from '../constants.ts';
import { GlobalErrorContext, GlobalErrorModal } from './GlobalErrorModal.tsx';

type Story = StoryObj<typeof meta>;

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn(({ subpath }) => `https://storybook.js.org/docs/${subpath}`).mockName(
      'api::getDocsUrl'
    ),
  },
};

const meta = {
  component: GlobalErrorModal,
  decorators: [
    (storyFn) => {
      const [isModalOpen, setModalOpen] = useState(false);
      return (
        <ManagerContext.Provider value={managerContext}>
          <GlobalErrorContext.Provider value={{ isModalOpen, setModalOpen }}>
            <div
              style={{
                width: '100%',
                minWidth: '1200px',
                height: '800px',
                background:
                  'repeating-linear-gradient(45deg, #000000, #ffffff 50px, #ffffff 50px, #ffffff 80px)',
              }}
            >
              {storyFn()}
            </div>
            <button onClick={() => setModalOpen(true)}>Open modal</button>
          </GlobalErrorContext.Provider>
        </ManagerContext.Provider>
      );
    },
  ],
  args: {
    onRerun: fn(),
    storeState: storeOptions.initialState,
  },
} satisfies Meta<typeof GlobalErrorModal>;

export default meta;

export const FatalError: Story = {
  args: {
    onRerun: fn(),
    storeState: {
      ...storeOptions.initialState,
      fatalError: {
        message: 'A wild hedgehog 🦔 wandered into the runtime',
        error: {
          message: dedent`
        FactoryError: Failed to create fresh balloon with adequate pressure
          at Constraint.execute (balloon-factory.js:525:2)
          at Constraint.recalculate (balloon-factory.js:424:21)
          at Planner.addPropagate (balloon-factory.js:701:6)
          at Constraint.satisfy (balloon-factory.js:184:15)
          at Planner.incrementalAdd (balloon-factory.js:591:21)
          at Constraint.addConstraint (balloon-factory.js:162:10)
          at Constraint.BinaryConstraint (balloon-factory.js:346:7)
          at Constraint.EqualityConstraint (balloon-factory.js:515:38)
          at chainTest (balloon-factory.js:807:6)
          at deltaBlue (balloon-factory.js:879:2)`,
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByText('Open modal');
    await userEvent.click(button);
    await expect(canvas.findByText('Storybook Test Error Details')).resolves.toBeInTheDocument();
  },
};

export const UnhandledErrors: Story = {
  ...FatalError,
  args: {
    onRerun: fn(),
    storeState: {
      ...storeOptions.initialState,
      currentRun: {
        ...storeOptions.initialState.currentRun,
        unhandledErrors: [
          {
            name: 'Error',
            message: 'this is an error thrown in a setTimeout in play',
            stack: dedent`Error: this is an error thrown in a setTimeout in play
    at http://localhost:63315/some/absolute/path/to/file.js?import&browserv=1742507455852:74:13`,
            VITEST_TEST_PATH: '/some/absolute/path/to/file.js',
            VITEST_TEST_NAME: 'My test',
            stacks: [
              {
                file: '/some/absolute/path/to/file.js',
                line: 74,
                column: 13,
                method: 'someMethod',
              },
              {
                file: '/some/absolute/path/to/other/file.js',
                line: 123,
                column: 45,
                method: 'someOtherMethod',
              },
            ],
          },
          {
            name: 'Error',
            message: 'this is an error rejected in play',
            stack: dedent`Error: this is an error rejected in play
    at play (http://localhost:63315/some/absolute/path/to/file.js?import&browserv=1742507682505:73:20)
    at runStory (http://localhost:63315/@fs/some/absolute/path/to/.vite/deps/chunk-YVH55Y2L.js?v=77e3ac43:31517:11)
    at async http://localhost:63315/@fs/some/absolute/path/to/.vite/deps/@storybook_addon-vitest_internal_test-utils.js?v=59e7fce5:121:5
    at async http://localhost:63315/@fs/some/absolute/path/to/@vitest/runner/dist/index.js?v=77e3ac43:573:22`,
            VITEST_TEST_PATH: '/some/absolute/path/to/file.js',
            VITEST_TEST_NAME: 'My other test',
            stacks: [
              {
                file: '/some/absolute/path/to/file.js',
                line: 73,
                column: 20,
                method: 'play',
              },
              {
                file: '/some/absolute/path/to/.vite/deps/chunk-YVH55Y2L.js',
                line: 31517,
                column: 11,
                method: 'runStory',
              },
            ],
          },
        ],
      },
    },
  },
};
