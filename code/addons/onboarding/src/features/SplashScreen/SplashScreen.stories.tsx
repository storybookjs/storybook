import type { Meta, StoryObj } from '@storybook/react';
import { SplashScreen } from './SplashScreen';

const meta = {
  component: SplashScreen,
  args: {
    onDismiss: () => {},
  },
} satisfies Meta<typeof SplashScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Static: Story = {
  args: {
    duration: 0,
  },
};
