import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '../../../csf-types.ts';

import { SHARED_LABEL } from './labels.ts';
import { MetaActionsComponent } from './meta-actions.component.ts';

// The shape every generated Angular project starts from: actions through `fn()` in the meta args.
const meta = {
  title: 'StoryDocs/meta-actions',
  component: MetaActionsComponent,
  args: { onClick: fn() },
} satisfies Meta<MetaActionsComponent>;

export default meta;

type Story = StoryObj<MetaActionsComponent>;

export const Primary: Story = {
  args: { primary: true, label: 'Button' },
};

export const ImportedLabel: Story = {
  args: { label: SHARED_LABEL },
};
