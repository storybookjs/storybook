import React from 'react';

import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { styled } from 'storybook/theming/emotion';

import preview from '../../../../../.storybook/preview.tsx';
import { Button } from '../Button/Button.tsx';
import { OverlayTriggerDecorator, Trigger } from '../shared/overlayHelpers.tsx';
import { PopoverProvider } from './PopoverProvider.tsx';

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
    ariaLabel: 'Sample popover',
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

const findPopoverIn = (overlay: HTMLElement, content: HTMLElement) =>
  Array.from(overlay.children).find((child) => child.contains(content)) as HTMLElement;

/**
 * The overlay react-aria positions against the trigger must be exactly as tall as the popover.
 * Any extra space below the popover shifts a top-placed popover away from its trigger.
 */
export const FillsTheOverlay = meta.story({
  args: {
    visible: true,
    children: <Trigger>Trigger</Trigger>,
    popover: <SamplePopover />,
    placement: 'top',
  },
  play: async ({ args }) => {
    const overlay = await screen.findByLabelText(args.ariaLabel!);
    const popover = findPopoverIn(overlay, screen.getByText('Lorem ipsum dolor sit amet'));
    await expect(overlay.getBoundingClientRect().height).toBe(
      popover.getBoundingClientRect().height
    );
  },
});

const OverhangingContent = styled.div({
  position: 'relative',
  width: 120,
  height: 60,
  background: 'lightblue',
});

const Handle = styled.div({
  position: 'absolute',
  top: -14,
  right: -14,
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'crimson',
});

/**
 * Content such as a color picker draws a drag handle past the popover's edge. A non-scrolling
 * popover must leave it visible rather than clip it.
 */
export const WithOverhangingContent = meta.story({
  args: {
    visible: true,
    scrollable: false,
    children: <Trigger>Trigger</Trigger>,
    popover: (
      <OverhangingContent>
        <Handle role="img" aria-label="Handle" />
      </OverhangingContent>
    ),
  },
  play: async ({ args }) => {
    const overlay = await screen.findByLabelText(args.ariaLabel!);
    const handle = screen.getByRole('img', { name: 'Handle' });
    const popover = findPopoverIn(overlay, handle);
    const { top, right } = handle.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    await expect(top).toBeLessThan(popoverRect.top);
    await expect(right).toBeGreaterThan(popoverRect.right);
    await expect(document.elementFromPoint(right - 4, top + 4)).toBe(handle);
  },
});

const TallContent = styled.div({
  width: 200,
  height: 3000,
  background: 'linear-gradient(lightblue, crimson)',
});

/** Content taller than the viewport scrolls inside the popover instead of overflowing the screen. */
export const WithTallContent = meta.story({
  args: {
    visible: true,
    children: <Trigger>Trigger</Trigger>,
    popover: <TallContent role="img" aria-label="Tall content" />,
    placement: 'bottom-start',
  },
  play: async ({ args }) => {
    const overlay = await screen.findByLabelText(args.ariaLabel!);
    const { top, bottom } = overlay.getBoundingClientRect();
    await expect(top).toBeGreaterThanOrEqual(0);
    await expect(bottom).toBeLessThanOrEqual(window.innerHeight);

    const viewport = overlay.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    await expect(screen.getByRole('img', { name: 'Tall content' })).toBeVisible();
  },
});

const WideContent = styled.div({
  width: 3000,
  height: 40,
  background: 'linear-gradient(to right, lightblue, crimson)',
});

/** Content wider than the viewport scrolls inside the popover instead of overflowing the screen. */
export const WithWideContent = meta.story({
  args: {
    visible: true,
    children: <Trigger>Trigger</Trigger>,
    popover: <WideContent role="img" aria-label="Wide content" />,
    placement: 'bottom-start',
  },
  play: async ({ args }) => {
    const overlay = await screen.findByLabelText(args.ariaLabel!);
    const { left, right } = overlay.getBoundingClientRect();
    await expect(left).toBeGreaterThanOrEqual(0);
    await expect(right).toBeLessThanOrEqual(window.innerWidth);

    const viewport = overlay.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
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

export const EscapeDismissalSuppressesFocusRestoreTooltip = meta.story({
  args: {
    children: <Button ariaLabel="Trigger button">Trigger</Button>,
    popover: 'Popover content',
  },
  render: (args) => (
    <div>
      <PopoverProvider {...args} />
      <Button ariaLabel="Other button">Other</Button>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Trigger button' });

    await step('Open popover with click', async () => {
      await userEvent.click(trigger);
      await expect(screen.getByText('Popover content')).toBeInTheDocument();
    });

    await step('Dismiss with Escape: the trigger tooltip must not open', async () => {
      await userEvent.keyboard('{Escape}');
      await expect(screen.queryByText('Popover content')).not.toBeInTheDocument();
      await expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    });

    await step('The next Escape reaches the document instead of being swallowed', async () => {
      const shortcutListener = fn();
      document.addEventListener('keydown', shortcutListener);
      try {
        await userEvent.keyboard('{Escape}');
        await expect(shortcutListener).toHaveBeenCalledTimes(1);
      } finally {
        document.removeEventListener('keydown', shortcutListener);
      }
    });
  },
});

export const KeyboardFocusTooltipStillOpens = meta.story({
  args: {
    children: <Button ariaLabel="Trigger button">Trigger</Button>,
    popover: 'Popover content',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Trigger button' })).toHaveFocus();
    await expect(await screen.findByTestId('tooltip')).toBeInTheDocument();
  },
});

export const FocusRestoreSuppressionIsOnceOnly = meta.story({
  args: {
    children: <Button ariaLabel="Trigger button">Trigger</Button>,
    popover: 'Popover content',
  },
  render: (args) => (
    <div>
      <PopoverProvider {...args} />
      <Button ariaLabel="Other button">Other</Button>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Trigger button' });

    await step('Open and dismiss with Escape: no tooltip', async () => {
      await userEvent.click(trigger);
      await expect(screen.getByText('Popover content')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await expect(screen.queryByText('Popover content')).not.toBeInTheDocument();
      await expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    });

    await step('A later keyboard refocus still opens the tooltip', async () => {
      await userEvent.tab();
      await userEvent.tab({ shift: true });
      await expect(canvas.getByRole('button', { name: 'Trigger button' })).toHaveFocus();
      await expect(await screen.findByTestId('tooltip')).toBeInTheDocument();
    });
  },
});
