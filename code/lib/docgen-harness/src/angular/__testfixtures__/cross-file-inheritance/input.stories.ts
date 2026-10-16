import type { Meta, StoryObj } from '../../csf-types.ts';

import { CrossFileInheritanceComponent } from './cross-file-inheritance.component.ts';

const meta = {
  title: 'AngularFixtures/CrossFileInheritance',
  component: CrossFileInheritanceComponent,
} satisfies Meta<CrossFileInheritanceComponent>;

export default meta;

export const PropsAsWritten: StoryObj<CrossFileInheritanceComponent> = {
  args: { heading: 'Storage almost full', dismissible: true },
};
