import type { Meta, StoryObj } from '../../csf-types.ts';

import { SignalNonLiteralDefaultsComponent } from './signal-non-literal-defaults.component.ts';

const meta = {
  title: 'AngularFixtures/SignalNonLiteralDefaults',
  component: SignalNonLiteralDefaultsComponent,
} satisfies Meta<SignalNonLiteralDefaultsComponent>;

export default meta;

export const PropsAsWritten: StoryObj<SignalNonLiteralDefaultsComponent> = {
  args: { list: [4, 5, 6], computed: 7, config: { a: 2 }, requiredValue: 'x' },
};
