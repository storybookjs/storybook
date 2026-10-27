import type { Meta, StoryObj } from '../../../csf-types.ts';

import { AsCastComponent } from './as-cast.component.ts';

export default {
  title: 'StoryDocs/as-cast',
  component: AsCastComponent,
} as Meta<AsCastComponent>;

/** Args behind an `as const` assertion. */
export const Casted = {
  args: { label: 'Cast', tone: 'warn' as const },
} as StoryObj<AsCastComponent>;

export const Satisfied = {
  args: { label: 'Satisfies' } satisfies Partial<AsCastComponent>,
} satisfies StoryObj<AsCastComponent>;
