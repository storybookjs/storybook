import type { Meta, StoryObj } from '@storybook/vue3';

import { expect, within } from 'storybook/test';

import Component from './template-slots/component.vue';

const meta = {
  component: Component,
  // These slot args only render as slots once the docgen-server payload categorizes them via
  // `argTypes[key].table.category === 'slots'`. Portable stories in the vitest run have no
  // docgen server, so there the merge is a no-op and the args would degrade to props — the
  // story is verified against the real preview (manager + docgen server) instead.
  tags: ['!vitest'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const StringSlots: Story = {
  args: {
    default: 'Hello transport',
    named: 'Hello named transport',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Under experimentalDocgenServer the slot-categorized args render inside the slot outlets;
    // before the transport fix they landed as unrecognized props and never reached the DOM.
    expect(canvas.getByText('Hello transport')).toBeTruthy();
    expect(canvas.getByText('Hello named transport')).toBeTruthy();
  },
};
