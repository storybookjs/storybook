import React from 'react';

import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { OverlayTriggerDecorator, Trigger } from '../shared/overlayHelpers';
import { PopoverProvider } from './PopoverProvider';

const StyledSamplePopover = styled.div({
  padding: 10,
  maxWidth: 200,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const SamplePopover = () => (
  <StyledSamplePopover>
    <h3>Lorem ipsum dolor sit amet</h3>
    <p>Consectatur vestibulum concet durum politu coret weirom</p>
    <button onClick={fn()}>Continue</button>
  </StyledSamplePopover>
);

const meta = preview.meta({
  id: 'overlay-PopoverProvider',
  title: 'Overlay/PopoverProvider',
  component: PopoverProvider,
  args: {
    hasChrome: true,
    offset: 8,
    placement: 'top',
  },
  decorators: [OverlayTriggerDecorator],
});

export const Base = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
});

export const Placements = meta.story({
  args: {
    children: <Trigger>ignored</Trigger>,
    popover: 'ignored',
  },
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <PopoverProvider {...args} placement="top" popover="Top placement">
        <Trigger>Top</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="top-start" popover="Top start placement">
        <Trigger>Top Start</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="top-end" popover="Top end placement">
        <Trigger>Top End</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="bottom" popover="Bottom placement">
        <Trigger>Bottom</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="bottom-start" popover="Bottom start placement">
        <Trigger>Bottom Start</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="bottom-end" popover="Bottom end placement">
        <Trigger>Bottom End</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="left" popover="Left placement">
        <Trigger>Left</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="left-start" popover="Left start placement">
        <Trigger>Left Start</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="left-end" popover="Left end placement">
        <Trigger>Left End</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="right" popover="Right placement">
        <Trigger>Right</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="right-start" popover="Right start placement">
        <Trigger>Right Start</Trigger>
      </PopoverProvider>
      <PopoverProvider {...args} placement="right-end" popover="Right end placement">
        <Trigger>Right End</Trigger>
      </PopoverProvider>
    </div>
  ),
});

export const WithChrome = meta.story({
  args: {
    hasChrome: true,
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
});

export const WithoutChrome = meta.story({
  args: {
    hasChrome: false,
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
});

export const CustomOffset = meta.story({
  args: {
    offset: 20,
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
});

export const CustomPadding = meta.story({
  args: {
    padding: 20,
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
});

export const WithCloseButton = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
    hasCloseButton: true,
  },
});

export const WithoutCloseButton = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
    hasCloseButton: false,
  },
});

export const AlwaysOpen = meta.story({
  args: {
    visible: true,
    children: <Trigger>Always visible tooltip</Trigger>,
    popover: <SamplePopover />,
    placement: 'right-start',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const popover = screen.getByText('Lorem ipsum dolor sit amet');
    await expect(popover).toBeInTheDocument();
  },
});

export const NeverOpen = meta.story({
  args: {
    visible: false,
    children: <Trigger>Never visible tooltip</Trigger>,
    popover: <SamplePopover />,
    placement: 'right-start',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Lorem ipsum dolor sit')).not.toBeInTheDocument();
  },
});

export const WithVisibilityCallback = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
    onVisibleChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText('Click me!');

    await userEvent.click(trigger);
    await expect(args.onVisibleChange).toHaveBeenCalledWith(true);

    await userEvent.click(trigger);
    await expect(args.onVisibleChange).toHaveBeenCalledWith(false);
  },
});

export const InteractivePopoverKB = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText('Click me!');

    await step('Open popover', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await expect(screen.queryByText('Lorem ipsum dolor sit amet')).toBeInTheDocument();
    });

    await step('Press Tab to enter popover', async () => {
      await userEvent.tab();
      const continueButton = await screen.findByText('Continue');
      await expect(continueButton).toHaveFocus();
    });

    await step('Press Esc to close popover', async () => {
      await userEvent.keyboard('{Escape}');
      await expect(canvas.queryByText('Lorem ipsum dolor sit amet')).not.toBeInTheDocument();
    });
  },
});

export const InteractivePopoverMouse = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    popover: <SamplePopover />,
  },
  render: (args) => (
    <div>
      <PopoverProvider {...args} />
      <button>Sibling Button</button>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Open popover', async () => {
      const trigger = canvas.getByText('Click me!');
      await userEvent.click(trigger);
      await expect(screen.queryByText('Lorem ipsum dolor sit amet')).toBeInTheDocument();
    });

    await step('Click outside popover to close it', async () => {
      const sibling = canvas.getByText('Sibling Button');
      await userEvent.click(sibling);
      await expect(screen.queryByText('Lorem ipsum dolor sit amet')).not.toBeInTheDocument();
    });
  },
});

export const WithLongContent = meta.story({
  args: {
    children: <Trigger>Long content</Trigger>,
    popover: (
      <div style={{ maxWidth: '300px', padding: '8px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Very Long Tooltip Content</h3>
        <p style={{ margin: '0', fontSize: '12px', lineHeight: '1.4' }}>
          This is a very long popover that demonstrates how the popover component handles extensive
          content. It should wrap properly and maintain good readability even with multiple lines of
          text. The popover positioning should also adapt to ensure it remains visible within the
          viewport boundaries.
        </p>
      </div>
    ),
  },
});
