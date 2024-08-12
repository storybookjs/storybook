import { action } from '@storybook/addon-actions';
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';

import { APP_INITIALIZER } from '@angular/core';

import Button from '../../button.component';

const meta: Meta<Button> = {
  component: Button,
  render: (args) => ({
    props: {
      ...args,
    },
  }),
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: APP_INITIALIZER,
          useFactory: () => {
            return action('APP_INITIALIZER useFactory called successfully');
          },
          multi: true,
        },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<Button>;

export const Default: Story = {
  args: {
    text: 'Button',
  },
};
