import type { Meta, StoryObj } from '@storybook/vue3';

import ModuleLevelConstants from './ModuleLevelConstants.vue';

const lines = ['a', 'b', 'c'];
const html = `<pre>${lines.join('\n')}</pre>`;
const changed = ['a'];
changed.push('b');

const meta = {
  component: ModuleLevelConstants,
  title: 'Forms/module-level-constants',
  args: { html, lines: lines.length },
} satisfies Meta<typeof ModuleLevelConstants>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MetaArgs: Story = {};

export const StoryArgs: Story = {
  args: { selectedLine: lines.length - 1, heading: lines[0] },
};

export const ChangedConstant: Story = {
  args: { selectedLine: changed.length },
};
