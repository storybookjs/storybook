import type { Meta, StoryObj } from '../../csf-types.ts';

import { SignalModelComponent } from './signal-model.component.ts';

const meta = {
  title: 'AngularFixtures/SignalModel',
  component: SignalModelComponent,
} satisfies Meta<SignalModelComponent>;

export default meta;

export const TwoWayBinding: StoryObj<SignalModelComponent> = {
  args: {
    value: 'hello',
    valueChange: () => {},
    checked: true,
  },
};
