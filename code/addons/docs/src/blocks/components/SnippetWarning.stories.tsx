import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import { SNIPPET_WARNING_LABEL, SnippetWarning } from './SnippetWarning';

/**
 * The caveat that travels with a story-docs snippet that is a deliberately incomplete example. Used
 * by the docs Source block, the Canvas action row and the manager Code panel.
 */
const meta = {
  component: SnippetWarning,
} satisfies Meta<typeof SnippetWarning>;

export default meta;

type Story = StoryObj<typeof meta>;

const WARNING =
  'LocalComponent is declared in the story file, so the snippet references it without importing it.';

export const Default: Story = {
  args: { warning: WARNING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', { name: SNIPPET_WARNING_LABEL });

    await expect(canvas.queryByText(WARNING)).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await expect(await within(document.body).findByText(WARNING)).toBeVisible();
  },
};

/** Providers join several caveats into one message, and each is its own line. */
export const MultipleCaveats: Story = {
  args: {
    warning: `${WARNING}\nThe snippet omits args that cannot be resolved statically: makeLabel().`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: SNIPPET_WARNING_LABEL }));

    const message = await within(document.body).findByText(/omits args/);
    await expect(message).toHaveTextContent(WARNING);
  },
};

/** A snippet with nothing to flag renders nothing at all. */
export const NoWarning: Story = {
  args: { warning: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};

/** A provider that sets the field but leaves it blank is treated as having nothing to say. */
export const BlankWarning: Story = {
  args: { warning: '   ' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};
