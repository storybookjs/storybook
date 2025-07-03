import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';

import { IntentSurvey } from './IntentSurvey';

const meta = {
  component: IntentSurvey,
  args: {
    onComplete: action('onComplete'),
    onDismiss: action('onDismiss'),
  },
} as Meta<typeof IntentSurvey>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {};
