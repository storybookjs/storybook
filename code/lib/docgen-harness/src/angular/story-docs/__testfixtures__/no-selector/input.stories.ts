import type { Meta, StoryObj } from '../../../csf-types.ts';

import { NoSelectorComponent } from './no-selector.component.ts';

const meta = {
  title: 'StoryDocs/no-selector',
  component: NoSelectorComponent,
} satisfies Meta<NoSelectorComponent>;

export default meta;

export const Primary: StoryObj<NoSelectorComponent> = {
  args: { label: 'Outlet' },
};
