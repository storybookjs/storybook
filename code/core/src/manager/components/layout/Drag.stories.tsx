import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import { Drag } from './Drag';

/**
 * Presentational drag-handle component used for the sidebar and addon-panel resizers.
 *
 * Covers positioning, tooltips and hover/focus states, and ARIA attribute markup. The actual
 * keyboard-resize logic lives in `useDragging` and can be tested in Layout stories.
 */
const meta = {
  title: 'Layout/Drag',
  component: Drag,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (storyFn) => (
      // Drag uses `position: absolute` so it needs a positioned parent.
      <div
        style={{
          position: 'relative',
          width: 200,
          height: 200,
          border: '2px dashed #aaa',
          background: 'thistle',
        }}
      >
        {storyFn()}
      </div>
    ),
  ],
} satisfies Meta<typeof Drag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PositionLeft: Story = {
  name: 'Position: left (sidebar)',
  args: {
    position: 'left',
    'aria-label': 'Sidebar resize handle',
    'aria-valuenow': 200,
    'aria-valuemax': 500,
  },
  play: async ({ canvas, step }) => {
    const handle = canvas.getByRole('separator');

    await step('Has aria-orientation="vertical" for left position', async () => {
      expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    });

    await step('Shows on the right of the parent element', async () => {
      handle.focus();
      const parentRect = handle.parentElement?.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      expect(handleRect.left).toBeGreaterThan(parentRect?.left ?? 0);
    });
  },
};

export const PositionRight: Story = {
  name: 'Position: right (addon panel)',
  args: {
    position: 'right',
    'aria-label': 'Addon panel resize handle',
    'aria-valuenow': 300,
    'aria-valuemax': 600,
  },
  play: async ({ canvas, step }) => {
    const handle = canvas.getByRole('separator');

    await step('Has aria-orientation="vertical" for right position', async () => {
      expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    });

    await step('Shows on the left of the parent element', async () => {
      handle.focus();
      const parentRect = handle.parentElement?.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      expect(handleRect.left).toBeLessThan(parentRect?.left ?? 0);
    });
  },
};

export const PositionBottom: Story = {
  name: 'Position: bottom (bottom panel)',
  args: {
    position: 'bottom',
    'aria-label': 'Addon panel resize handle',
    'aria-valuenow': 150,
    'aria-valuemax': 400,
  },
  play: async ({ canvas, step }) => {
    const handle = canvas.getByRole('separator');

    await step('Has aria-orientation="horizontal" for bottom position', async () => {
      expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
    });

    await step('Shows on the top of the parent element', async () => {
      handle.focus();
      const parentRect = handle.parentElement?.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      expect(handleRect.top).toBeLessThan(parentRect?.top ?? 0);
    });
  },
};

export const PositionTop: Story = {
  name: 'Position: top',
  args: {
    position: 'top',
    'aria-label': 'Top panel resize handle',
    'aria-valuenow': 150,
    'aria-valuemax': 400,
  },
  play: async ({ canvas, step }) => {
    const handle = canvas.getByRole('separator');

    await step('Has aria-orientation="horizontal" for top position', async () => {
      expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
    });

    await step('Shows on the bottom of the parent element', async () => {
      handle.focus();
      const parentRect = handle.parentElement?.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      expect(handleRect.top).toBeGreaterThan(parentRect?.top ?? 0);
    });
  },
};

export const AriaRole: Story = {
  name: 'ARIA: role separator',
  args: {
    position: 'left',
    'aria-label': 'Sidebar resize handle',
    'aria-valuenow': 240,
    'aria-valuemax': 480,
  },
  play: async ({ canvas, step }) => {
    await step('Has role="separator"', async () => {
      const handle = canvas.getByRole('separator');
      expect(handle).toBeInTheDocument();
    });
  },
};

export const AriaOrientationVertical: Story = {
  name: 'ARIA: orientation vertical',
  args: {
    position: 'left',
    'aria-label': 'Sidebar resize handle',
    'aria-valuenow': 240,
    'aria-valuemax': 480,
  },
  play: async ({ canvas, step }) => {
    await step('Has aria-orientation="vertical" for left position', async () => {
      const handle = canvas.getByRole('separator');
      expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    });
  },
};

export const AriaOrientationHorizontal: Story = {
  name: 'ARIA: orientation horizontal',
  args: {
    position: 'bottom',
    'aria-label': 'Bottom panel resize handle',
    'aria-valuenow': 150,
    'aria-valuemax': 400,
  },
  play: async ({ canvas, step }) => {
    await step('Has aria-orientation="horizontal" for bottom position', async () => {
      const handle = canvas.getByRole('separator');
      expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
    });
  },
};

export const AriaLabel: Story = {
  name: 'ARIA: aria-label',
  args: {
    position: 'bottom',
    'aria-label': 'Specific resize handle label',
    'aria-valuenow': 150,
    'aria-valuemax': 400,
  },
  play: async ({ canvas, step }) => {
    await step('Has correct aria-label', async () => {
      const handle = canvas.getByRole('separator');
      expect(handle).toHaveAttribute('aria-label', 'Specific resize handle label');
    });
  },
};

export const AriaValue: Story = {
  name: 'ARIA: aria-value* attributes',
  args: {
    position: 'bottom',
    'aria-label': 'Specific resize handle label',
    'aria-valuenow': 150,
    'aria-valuemax': 400,
  },
  play: async ({ canvas, step }) => {
    await step('Has correct aria-value* attributes', async () => {
      const handle = canvas.getByRole('separator');
      expect(handle).toHaveAttribute('aria-valuemin', '0');
      expect(handle).toHaveAttribute('aria-valuenow', '150');
      expect(handle).toHaveAttribute('aria-valuemax', '400');
    });
  },
};

export const FocusTooltipVertical: Story = {
  name: 'Keyboard: vertical focus tooltip',
  args: {
    position: 'left',
    'aria-label': 'Sidebar resize handle',
    'aria-valuenow': 200,
    'aria-valuemax': 500,
  },
  play: async ({ canvas, step }) => {
    const handle = canvas.getByRole('separator');

    await step('Tab onto the handle', async () => {
      await userEvent.tab();
      expect(handle).toHaveFocus();
    });

    await step('Tooltip with ← → hint is visible', async () => {
      // The tooltip is rendered in a portal outside canvas.
      const tooltip = await within(document.body).findByText('← → to resize');
      expect(tooltip).toBeInTheDocument();
    });

    await step('Tooltip disappears on blur', async () => {
      handle.blur();
      // Give the tooltip time to un-mount / fade out.
      await new Promise((r) => setTimeout(r, 250));
      const tooltip = within(document.body).queryByText('← → to resize');
      expect(tooltip).not.toBeInTheDocument();
    });
  },
};

export const FocusTooltipHorizontal: Story = {
  name: 'Keyboard: horizontal focus tooltip',
  args: {
    position: 'bottom',
    'aria-label': 'Bottom panel resize handle',
    'aria-valuenow': 150,
    'aria-valuemax': 400,
  },
  play: async ({ canvas, step }) => {
    const handle = canvas.getByRole('separator');

    await step('Tab onto the handle', async () => {
      await userEvent.tab();
      expect(handle).toHaveFocus();
    });

    await step('Tooltip with ↑ ↓ hint is visible', async () => {
      const tooltip = await within(document.body).findByText('↑ ↓ to resize');
      expect(tooltip).toBeInTheDocument();
    });
  },
};
