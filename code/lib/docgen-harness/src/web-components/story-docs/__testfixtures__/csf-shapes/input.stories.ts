import type { Meta, Story } from '../../../csf-types.ts';

import { importedLabel, itemsFixture, sharedArgs } from './shared-args.ts';
import './csf-shapes.js';

const meta = {
  title: 'WebComponentsStoryDocs/CsfShapes',
  component: 'csf-shapes',
  args: { label: 'Meta' },
} satisfies Meta;

export default meta;

export const AuthoredCode: Story = {
  parameters: { docs: { source: { code: '<csf-shapes label="authored"></csf-shapes>' } } },
};

export const AuthoredDisabled: Story = {
  parameters: { docs: { source: { code: null } } },
};

export const SpreadArgs: Story = {
  args: { ...sharedArgs, count: 2 },
};

export const ImportedItems: Story = {
  args: { items: itemsFixture },
};

export const ImportedLabel: Story = {
  args: { label: importedLabel },
};

export const Listener: Story = {
  args: { 'shape-change-event': () => {}, onShapeChange: () => {} },
};

export const UnknownArg: Story = {
  args: { nope: 1 },
};

export const Slots: Story = {
  args: { 'default-slot': 'Body <b>text</b>', 'actions-slot': '<button>Go</button>' },
};

export const PartsAndCss: Story = {
  args: {
    'panel-part': 'color: red;',
    'active-state': 'outline: 1px solid;',
    '--csf-shapes-accent': 'teal',
  },
};

export const Unset: Story = {
  args: { label: undefined, disabled: true },
};

export const RenderFallback: Story = {
  args: { label: 'Fallback' },
  render: () => document.createElement('csf-shapes'),
};
