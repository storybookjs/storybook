import type { Meta, StoryObj } from '../../../csf-types.ts';

import { moduleMetadata } from '@storybook/angular-vite';

import { LegacyButtonComponent, LegacyButtonModule } from './non-standalone-module.component.ts';

const meta = {
  title: 'StoryDocs/non-standalone-module',
  component: LegacyButtonComponent,
  decorators: [moduleMetadata({ imports: [LegacyButtonModule] })],
  args: { label: 'Legacy' },
} satisfies Meta<LegacyButtonComponent>;

export default meta;

type Story = StoryObj<LegacyButtonComponent>;

export const Primary: Story = {};
