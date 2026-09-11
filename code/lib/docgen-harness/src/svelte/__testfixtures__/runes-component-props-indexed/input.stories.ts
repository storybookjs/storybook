import type { ComponentProps } from 'svelte';

import type { Meta, StoryObj } from '@storybook/svelte';

import Modal from './Modal.svelte';

const meta = {
  title: 'SvelteFixtures/ModalPlain',
  component: Modal,
  args: { id: 'plain-modal', open: true },
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { confirmType: 'secondary', error: '' },
};

export const WithRender: Story = {
  args: { id: 'render-modal', open: true, confirmType: 'primary' },
  render: (args) => ({ Component: Modal, props: args }),
};

const Template = (args: ComponentProps<typeof Modal>) => ({ Component: Modal, props: args });

export const Bound = Template.bind({}) as typeof Template & Story;
Bound.args = { id: 'bound-modal', open: true, error: 'Bound error' };
