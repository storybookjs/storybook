import type { Meta, StoryObj } from '../../../csf-types.ts';

import { NonStandaloneComponent } from './non-standalone.component.ts';

const meta = {
  title: 'StoryDocs/non-standalone',
  component: NonStandaloneComponent,
  args: { label: 'Legacy' },
} satisfies Meta<NonStandaloneComponent>;

export default meta;

type Story = StoryObj<NonStandaloneComponent>;

export const Primary: Story = {};
