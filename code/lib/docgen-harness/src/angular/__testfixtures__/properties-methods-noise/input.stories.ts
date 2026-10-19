import type { Meta, StoryObj } from '../../csf-types.ts';

import { PropertiesMethodsNoiseComponent } from './properties-methods-noise.component.ts';

const meta = {
  title: 'AngularFixtures/PropertiesMethodsNoise',
  component: PropertiesMethodsNoiseComponent,
} satisfies Meta<PropertiesMethodsNoiseComponent>;

export default meta;

export const PropsAsWritten: StoryObj<PropertiesMethodsNoiseComponent> = {
  args: { title: 'Paged results' },
};
