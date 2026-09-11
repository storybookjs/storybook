import type { Meta, StoryObj } from '../../../csf-types.ts';

const meta: Meta = {
  title: 'StoryDocs/no-component',
};

export default meta;

/** Documented without a component, so there is nothing to derive a snippet from. */
export const Primary: StoryObj = {
  args: { label: 'Orphan' },
};
