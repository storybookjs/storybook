import type { Meta, Story } from '../../../csf-types.ts';

import './module-level-constants.js';

const lines = ['a', 'b', 'c'];
const html = `<pre>${lines.join('\n')}</pre>`;
const changed = ['a'];
changed.push('b');

const meta = {
  title: 'WebComponentsStoryDocs/ModuleLevelConstants',
  component: 'constants-viewer',
  args: { html, lines: lines.length },
} satisfies Meta;

export default meta;

export const MetaArgs: Story = {};

export const StoryArgs: Story = {
  args: { selectedLine: lines.length - 1, heading: lines[0] },
};

export const ChangedConstant: Story = {
  args: { selectedLine: changed.length },
};
