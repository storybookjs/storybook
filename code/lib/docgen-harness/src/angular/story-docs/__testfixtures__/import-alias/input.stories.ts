import type { Meta, StoryObj } from '../../../csf-types.ts';

import { ImportAliasComponent as Alias } from './aliased.component.ts';

const meta = {
  title: 'StoryDocs/import-alias',
  component: Alias,
} satisfies Meta<Alias>;

export default meta;

export const Primary: StoryObj<Alias> = {
  args: { heading: 'Aliased' },
};
