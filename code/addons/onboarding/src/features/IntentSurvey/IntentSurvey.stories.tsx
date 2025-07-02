import type { Meta, StoryObj } from '@storybook/react-vite';

import { IntentSurvey } from './IntentSurvey';

const meta = {
  title: 'Onboarding/IntentSurvey',
  component: IntentSurvey,
} as Meta<typeof IntentSurvey>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {};
