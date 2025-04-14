import { Meta, StoryObj } from '@storybook/angular';

import {
  EnumNumeric,
  EnumNumericInitial,
  EnumStringValues,
  EnumsComponent,
} from './enums.component';

const meta: Meta<EnumsComponent> = {
  // title: 'Basics / Component / With Enum Types',
  component: EnumsComponent,
};

export default meta;

type Story = StoryObj<EnumsComponent>;

export const Basic: Story = {
  args: {
    unionType: 'Union A',
    aliasedUnionType: 'Type Alias 1',
    enumNumeric: EnumNumeric.FIRST,
    enumNumericInitial: EnumNumericInitial.UNO,
    enumStrings: EnumStringValues.PRIMARY,
    enumAlias: EnumNumeric.FIRST,
  },
};
