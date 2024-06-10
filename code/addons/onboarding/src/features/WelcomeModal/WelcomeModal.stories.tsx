import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { WelcomeModal } from './WelcomeModal';

const meta: Meta<typeof WelcomeModal> = {
  component: WelcomeModal,
  // This decorator is used to show the modal in the side by side view
  decorators: [
    (Story, context) => {
      const [container, setContainer] = useState<HTMLElement | undefined>(undefined);

      if (context.globals.theme === 'side-by-side') {
        return (
          <div
            ref={(element) => {
              if (element) {
                setContainer(element);
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '600px',
              transform: 'translateZ(0)',
            }}
          >
            {Story({ args: { ...context.args, container } })}
          </div>
        );
      }

      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
