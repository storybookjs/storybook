import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyExample } from './EmptyExample';

/** This is the description for the component */
const meta = {
  title: 'examples/Stories for the DocsPage',
  component: EmptyExample,
} satisfies Meta<typeof EmptyExample>;
export default meta;

type Story = StoryObj<typeof meta>;

/** This is the description for the primary story */
export const SingleStory: Story = {};
