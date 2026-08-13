import type { Meta, StoryObj } from '../../../csf-types.ts';

import { OverrideComponent } from './override.component.ts';

const meta = {
  title: 'StoryDocs/import-override',
  component: OverrideComponent,
} satisfies Meta<OverrideComponent>;

export default meta;

export const Primary: StoryObj<OverrideComponent> = {
  args: { heading: 'Overridden' },
};
