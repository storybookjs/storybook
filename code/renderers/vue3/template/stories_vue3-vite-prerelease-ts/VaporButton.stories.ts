import {
  GLOBALS_UPDATED,
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';

import type { Meta, StoryObj } from '@storybook/vue3';

import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import VaporButton from './VaporButton.vue';

const onClick = fn();

/** A Vapor mode component, rendered through Vue's interop with the VDOM app Storybook creates. */
const meta = {
  // `Meta` rejects the function type that vue-tsc gives Vapor components, like it does for generic components.
  component: VaporButton as Meta['component'],
  args: { label: 'Vapor', onClick },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const IsVapor: Story = {
  play: async ({ canvas }) => {
    await expect((VaporButton as { __vapor?: boolean }).__vapor).toBe(true);
    await expect(canvas.getByRole('button')).toHaveTextContent('Vapor 0');
  },
};

export const EmitsEvents: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await userEvent.click(button);
    await expect(button).toHaveTextContent('Vapor 2');
    await expect(onClick).toHaveBeenLastCalledWith(2);
  },
};

export const VdomInVaporSlot: Story = {
  render: (args) => ({
    components: {
      VaporButton,
      VdomChild: { template: '<em data-testid="vdom-child">VDOM child</em>' },
    },
    setup: () => ({ args }),
    template: '<VaporButton v-bind="args"><VdomChild /></VaporButton>',
  }),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    await expect(within(button).getByTestId('vdom-child')).toHaveTextContent('VDOM child');
  },
};

export const VdomInNamedVaporSlot: Story = {
  render: (args) => ({
    components: {
      VaporButton,
      VdomChild: { template: '<em data-testid="vdom-child">VDOM child</em>' },
    },
    setup: () => ({ args }),
    template: '<VaporButton v-bind="args"><template #icon><VdomChild /></template></VaporButton>',
  }),
  play: async ({ canvas }) => {
    const icon = canvas.getByTestId('icon');
    await expect(icon).toContainElement(canvas.getByTestId('vdom-child'));
  },
};

export const InDecorator: Story = {
  decorators: [() => ({ template: '<div data-testid="decorator"><story/></div>' })],
  play: async ({ canvas }) => {
    const decorator = canvas.getByTestId('decorator');
    await expect(within(decorator).getByRole('button')).toHaveTextContent('Vapor 0');
  },
};

export const ReactiveArgs: Story = {
  tags: ['!vitest'],
  play: async ({ canvas, id }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const button = canvas.getByRole('button');

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));
    await userEvent.click(button);

    await channel.emit(UPDATE_STORY_ARGS, { storyId: id, updatedArgs: { label: 'Updated' } });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));
    await expect(canvas.getByRole('button')).toHaveTextContent('Updated 1');
  },
};

export const ReactiveGlobals: Story = {
  tags: ['!vitest'],
  render: (args, { globals }) => ({
    components: { VaporButton },
    setup: () => ({ args, globals }),
    template: '<VaporButton v-bind="args" :label="globals.locale" />',
  }),
  play: async ({ canvas }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const updateLocale = async (locale: string) => {
      const updated = new Promise((resolve) => channel.once(GLOBALS_UPDATED, resolve));
      channel.emit(UPDATE_GLOBALS, { globals: { locale } });
      await updated;
    };
    const button = canvas.getByRole('button');

    await userEvent.click(button);
    await updateLocale('es');
    await waitFor(() => expect(canvas.getByRole('button')).toHaveTextContent('es 1'));
    await updateLocale('en');
  },
};
