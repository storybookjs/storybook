import type { Meta, Story } from '../../csf-types.ts';

import './lit-schema-warning.ts';

const meta = {
  title: 'WebComponentsFixtures/LitSchemaWarning',
  component: 'lit-schema-warning',
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { label: 'Hello', count: 2 },
};
