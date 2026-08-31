import type { Meta, StoryObj } from '../../../csf-types.ts';

import { BasicComponent } from './basic.component.ts';

const meta = {
  title: 'StoryDocs/basic',
  component: BasicComponent,
  args: { label: 'Base' },
} satisfies Meta<BasicComponent>;

export default meta;

type Story = StoryObj<BasicComponent>;

/**
 * The default state.
 *
 * @summary Primary look
 */
export const Primary: Story = {
  args: { count: 3 },
};

/** Named through the `name` annotation. */
export const Renamed: Story = {
  name: 'Custom name',
  args: { label: 'Override' },
};
