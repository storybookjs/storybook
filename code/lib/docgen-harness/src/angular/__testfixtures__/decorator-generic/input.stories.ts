import type { Meta, StoryObj } from '../../csf-types.ts';

import { DecoratorGenericComponent } from './decorator-generic.component.ts';

const meta = {
  title: 'AngularFixtures/DecoratorGeneric',
  component: DecoratorGenericComponent,
} satisfies Meta<DecoratorGenericComponent<string>>;

export default meta;

export const PropsAsWritten: StoryObj<DecoratorGenericComponent<string>> = {
  args: { items: ['alpha', 'beta'], selected: 'alpha' },
};
