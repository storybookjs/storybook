import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import { SNIPPET_WARNING_LABEL, SnippetWarning } from './SnippetWarning';

const meta = {
  component: SnippetWarning,
} satisfies Meta<typeof SnippetWarning>;

export default meta;

type Story = StoryObj<typeof meta>;

const WARNING =
  'LocalComponent is declared in the story file, so the snippet references it without importing it.';

// Focus, not hover: react-aria delays a hovered tooltip by 400ms unless another was shown in the
// last 500ms, which it tracks globally, so hover races the findBy timeout. Focus opens immediately.
export const Default: Story = {
  args: { warning: WARNING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', { name: SNIPPET_WARNING_LABEL });

    await expect(within(document.body).queryByText(WARNING)).not.toBeInTheDocument();

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
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
    const trigger = await canvas.findByRole('button', { name: SNIPPET_WARNING_LABEL });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    const note = await within(document.body).findByText(/omits args/);
    await expect(note).toHaveTextContent(WARNING);
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
