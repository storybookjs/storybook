import type { Meta, StoryObj } from '../../csf-types.ts';

import { ComplexSelectorComponent } from './complex-selector.component.ts';

const meta = {
  title: 'AngularFixtures/ComplexSelector',
  component: ComplexSelectorComponent,
} satisfies Meta<ComplexSelectorComponent>;

export default meta;

export const PropsAsWritten: StoryObj<ComplexSelectorComponent> = {
  args: { emphasis: true },
};
