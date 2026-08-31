import type { Meta, StoryObj } from '../../csf-types.ts';

import { DecoratorGetterSetterComponent } from './decorator-getter-setter.component.ts';

const meta = {
  title: 'AngularFixtures/DecoratorGetterSetter',
  component: DecoratorGetterSetterComponent,
} satisfies Meta<DecoratorGetterSetterComponent>;

export default meta;

export const PropsAsWritten: StoryObj<DecoratorGetterSetterComponent> = {
  args: { volume: 7 },
};
