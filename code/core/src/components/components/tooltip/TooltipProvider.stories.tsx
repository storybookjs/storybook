import React from 'react';

import { Popover, TooltipNote } from 'storybook/internal/components';

import { expect, fn, screen } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { OverlayTriggerDecorator, Trigger } from '../shared/overlayHelpers';
import { TooltipProvider } from './TooltipProvider';

const SampleTooltip = () => 'Lorem ipsum dolor sit';
const SampleTooltipNote = () => <TooltipNote note="This note appears on hover and focus" />;

const meta = preview.meta({
  id: 'overlay-TooltipProvider',
  title: 'Overlay/TooltipProvider',
  component: TooltipProvider,
  args: {
    triggerOnFocusOnly: false,
    placement: 'top',
    offset: 8,
    delayShow: 400,
    delayHide: 200,
    tooltip: <SampleTooltipNote />,
    children: <Trigger>Hover me!</Trigger>,
  },
  decorators: [OverlayTriggerDecorator],
});

export const Base = meta.story({
  args: {
    tooltip: <SampleTooltipNote />,
    children: <Trigger>Hover me!</Trigger>,
  },
});

export const FocusOnly = meta.story({
  args: {
    triggerOnFocusOnly: true,
    tooltip: <SampleTooltipNote />,
    children: <Trigger tabIndex={0}>Focus me!</Trigger>,
  },
});

export const Placements = meta.story({
  args: {
    children: <button>ignored</button>,
    tooltip: 'ignored',
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
      <TooltipProvider {...args} placement="top" tooltip="Top placement">
        <Trigger>Top</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="top-start" tooltip="Top start placement">
        <Trigger>Top Start</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="top-end" tooltip="Top end placement">
        <Trigger>Top End</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="bottom" tooltip="Bottom placement">
        <Trigger>Bottom</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="bottom-start" tooltip="Bottom start placement">
        <Trigger>Bottom Start</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="bottom-end" tooltip="Bottom end placement">
        <Trigger>Bottom End</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="left" tooltip="Left placement">
        <Trigger>Left</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="left-start" tooltip="Left start placement">
        <Trigger>Left Start</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="left-end" tooltip="Left end placement">
        <Trigger>Left End</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="right" tooltip="Right placement">
        <Trigger>Right</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="right-start" tooltip="Right start placement">
        <Trigger>Right Start</Trigger>
      </TooltipProvider>
      <TooltipProvider {...args} placement="right-end" tooltip="Right end placement">
        <Trigger>Right End</Trigger>
      </TooltipProvider>
    </div>
  ),
});

/** TooltipNote is the recommended Tooltip to use within Storybook. */
export const WithTooltipNote = meta.story({
  args: {
    tooltip: SampleTooltipNote(),
    children: <Trigger>Hover me!</Trigger>,
  },
});

export const WithCustomTooltip = meta.story({
  args: {
    tooltip: (
      <Popover hasChrome color="positive" padding={8}>
        This is a custom tooltip !
      </Popover>
    ),
    children: <Trigger>Hover me!</Trigger>,
  },
});

export const WithLongContent = meta.story({
  args: {
    tooltip: (
      <Popover style={{ maxWidth: 300 }} color="positive" hasChrome padding={8}>
        <h3 style={{ margin: '0 0 8px 0' }}>Very Long Tooltip Content</h3>
        <p style={{ margin: '0', fontSize: '12px', lineHeight: '1.4' }}>
          This is a very long tooltip that demonstrates how the tooltip component handles extensive
          content. It should wrap properly and maintain good readability even with multiple lines of
          text. The tooltip positioning should also adapt to ensure it remains visible within the
          viewport boundaries.
        </p>
      </Popover>
    ),
    children: <Trigger>Long content</Trigger>,
  },
});

export const WithComplexContent = meta.story({
  args: {
    tooltip: (
      <Popover style={{ maxWidth: 300 }} color="positive" hasChrome padding={8}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Complex Tooltip</h3>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
          This tooltip contains multiple elements including:
        </p>
        <ul style={{ margin: '0', paddingLeft: '16px', fontSize: '12px' }}>
          <li>Headings</li>
          <li>Paragraphs</li>
          <li>Lists</li>
          <li>And more!</li>
        </ul>
      </Popover>
    ),
    children: <Trigger>Complex content</Trigger>,
  },
});

export const CustomOffset = meta.story({
  args: {
    offset: 20,
    tooltip: <TooltipNote note="Tooltip with custom offset (20px)" />,
    children: <Trigger>Hover me!</Trigger>,
  },
});

export const CustomDelays = meta.story({
  args: {
    delayShow: 1000,
    delayHide: 500,
    tooltip: <TooltipNote note="Tooltip with custom delays (1000ms show, 500ms hide)" />,
    children: <Trigger>Hover me!</Trigger>,
  },
});

export const Instantaneous = meta.story({
  args: {
    delayShow: 0,
    delayHide: 0,
    tooltip: <TooltipNote note="Tooltip with no delays" />,
    children: <Trigger>Hover me!</Trigger>,
  },
});

export const AlwaysOpen = meta.story({
  args: {
    visible: true,
    tooltip: <SampleTooltip />,
    children: <Trigger>Always visible tooltip</Trigger>,
    placement: 'right-start',
  },
  play: async () => {
    await expect(await screen.findByText('Lorem ipsum dolor sit')).toBeInTheDocument();
  },
});

export const NeverOpen = meta.story({
  args: {
    visible: false,
    tooltip: <SampleTooltip />,
    children: <Trigger>Never visible tooltip</Trigger>,
    placement: 'right-start',
  },
  play: async () => {
    await expect(await screen.queryByText('Lorem ipsum dolor sit')).not.toBeInTheDocument();
  },
});

export const WithVisibilityCallback = meta.story({
  args: {
    onVisibleChange: fn(),
    tooltip: <TooltipNote note="Tooltip with visibility callback" />,
    children: <Trigger>Hover me!</Trigger>,
  },
});
