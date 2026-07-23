import type { Meta, StoryObj } from '../../csf-types.ts';

import { ButtonKind } from './types.ts';
import { DecoratorUnionEnumComponent } from './decorator-union-enum.component.ts';

const meta = {
  title: 'AngularFixtures/DecoratorUnionEnum',
  component: DecoratorUnionEnumComponent,
} satisfies Meta<DecoratorUnionEnumComponent>;

export default meta;

export const PropsAsWritten: StoryObj<DecoratorUnionEnumComponent> = {
  args: { size: 'large', tone: 'warn', kind: ButtonKind.Secondary },
};
