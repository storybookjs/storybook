import type { Meta, StoryObj } from '../../csf-types.ts';

import { ExpressionDefaultsComponent } from './expression-defaults.component.ts';

const meta = {
  title: 'AngularFixtures/ExpressionDefaults',
  component: ExpressionDefaultsComponent,
} satisfies Meta<ExpressionDefaultsComponent>;

export default meta;

export const PropsAsWritten: StoryObj<ExpressionDefaultsComponent> = {
  args: { rows: 8, timeoutMs: 1000 },
};
