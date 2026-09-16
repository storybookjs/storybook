import type { Meta, StoryObj } from '@storybook/vue3';

import { expect, waitFor } from 'storybook/test';

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
    // Slot args render as raw text nodes (Vue slot semantics — no wrapper element), so element
    // matchers like getByText cannot see them. Under experimentalDocgenServer the payload can
    // also arrive just after the first render, so wait for the categorized re-render to land.
    await waitFor(
      () => {
        expect(canvasElement.textContent).toContain('Hello transport');
        expect(canvasElement.textContent).toContain('Hello named transport');
      },
      { timeout: 5000 }
    );
  },
};
