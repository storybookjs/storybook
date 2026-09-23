import type { Meta, StoryObj } from '@storybook/nextjs';

import { Button } from './Button.tsx';

const meta = { component: Button } satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { label: 'Next.js' } };
