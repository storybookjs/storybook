import type { Meta, Story } from '../../../csf-types.ts';

import './string-template.js';

const meta = {
  title: 'WebComponentsStoryDocs/StringTemplate',
  component: 'string-template',
} satisfies Meta;

export default meta;

export const Untagged: Story = {
  args: { label: 'Untagged', flag: true },
  render: (args) => `<string-template label="${args.label}" ?fake=${args.flag}></string-template>`,
};

export const PlainString: Story = {
  render: () => '<string-template label="static"></string-template>',
};

export const Default: Story = {
  args: { label: 'Default' },
};
