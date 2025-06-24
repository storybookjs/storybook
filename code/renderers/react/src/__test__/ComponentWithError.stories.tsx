import type { Meta, StoryObj } from '..';
import { ComponentWithError } from './ComponentWithError';

const meta = {
  title: 'Example/ComponentWithError',
  component: ComponentWithError as any,
} satisfies Meta<typeof ComponentWithError>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThrowsError: Story = {};
