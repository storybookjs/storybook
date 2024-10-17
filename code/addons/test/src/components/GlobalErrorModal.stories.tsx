import React, { useState } from 'react';

import { ManagerContext } from 'storybook/internal/manager-api';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';

import dedent from 'ts-dedent';

import { GlobalErrorModal } from './GlobalErrorModal';

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
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>
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
      </ManagerContext.Provider>
    ),
  ],
  args: {
    onRerun: fn(),
    onClose: fn(),
    open: false,
  },
} satisfies Meta<typeof GlobalErrorModal>;

export default meta;

export const Default: Story = {
  args: {
    error: dedent`
    ReferenceError: FAIL is not defined
      at Constraint.execute (the-best-file.js:525:2)
      at Constraint.recalculate (the-best-file.js:424:21)
      at Planner.addPropagate (the-best-file.js:701:6)
      at Constraint.satisfy (the-best-file.js:184:15)
      at Planner.incrementalAdd (the-best-file.js:591:21)
      at Constraint.addConstraint (the-best-file.js:162:10)
      at Constraint.BinaryConstraint (the-best-file.js:346:7)
      at Constraint.EqualityConstraint (the-best-file.js:515:38)
      at chainTest (the-best-file.js:807:6)
      at deltaBlue (the-best-file.js:879:2)`,
  },
  render: (props) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <GlobalErrorModal {...props} open={isOpen} />
        <button onClick={() => setOpen(true)}>Open modal</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByText('Open modal');
    await userEvent.click(button);
    await expect(canvas.findByText('Storybook Tests error details')).resolves.toBeInTheDocument();
  },
};
