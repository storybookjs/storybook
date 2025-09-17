import React from 'react';

import {
  CommandIcon,
  InfoIcon,
  PinIcon,
  QuestionIcon,
  StorybookIcon,
  WandIcon,
} from '@storybook/icons';

import { expect, fn, screen, userEvent, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { OverlayTriggerDecorator, Trigger } from '../shared/overlayHelpers';
import { WithMenu, type WithMenuProps } from './WithMenu';

const SampleItems = [
  {
    id: 'first',
    title: 'Lorem ipsum dolor sit amet',
    onAction: fn(),
  },
  {
    id: 'second',
    title: 'Consectatur vestibulum concet durum politu coret weirom',
    onAction: fn(),
  },
  { type: 'separator' },
  {
    id: 'third',
    icon: <StorybookIcon />,
    title: 'Storybook',
    href: 'http://localhost:6006',
    showExternalIcon: true,
  },
  { type: 'separator' },
  {
    id: 'fourth',
    icon: <PinIcon />,
    title: 'Local link',
    href: '?path=/story/tooltip-withmenu--base',
  },
] satisfies WithMenuProps['items'];

const ClassicMenu = [
  {
    id: 'about',
    title: 'About your Storybook',
    icon: <InfoIcon />,
    onAction: fn().mockName('About'),
  },
  {
    id: 'whats-new',
    title: "What's new?",
    icon: <WandIcon />,
    isHighlighted: true,
    onAction: fn().mockName("What's new?"),
  },
  {
    id: 'documentation',
    title: 'Documentation',
    showExternalIcon: true,
    onAction: fn().mockName('Documentation'),
  },
  {
    id: 'shortcuts',
    title: 'Shortcuts',
    icon: <CommandIcon />,
    onAction: fn().mockName('Shortcuts'),
  },
  { type: 'separator' },
  {
    id: 'sidebar',
    title: 'Hide sidebar',
    shortcut: ['alt', 's'],
    onAction: fn().mockName('Hide sidebar'),
  },
  {
    id: 'toolbar',
    title: 'Hide toolbar',
    shortcut: ['alt', 't'],
    onAction: fn().mockName('Hide toolbar'),
  },
  {
    id: 'addons',
    title: 'Hide addons panel',
    shortcut: ['alt', 'a'],
    onAction: fn().mockName('Hide addons panel'),
  },
  {
    id: 'addon-orientation',
    title: 'Change addons orientation',
    shortcut: ['alt', 'd'],
    onAction: fn().mockName('Change addons orientation'),
  },
  {
    id: 'fullscren',
    title: 'Go fullscren',
    shortcut: ['alt', 'f'],
    onAction: fn().mockName('Go fullscren'),
  },
  {
    id: 'search',
    title: 'Search',
    shortcut: ['control', 'k'],
    onAction: fn().mockName('Search'),
  },
  { type: 'separator' },
  {
    id: 'help',
    title: 'Get help',
    icon: <QuestionIcon />,
    showExternalIcon: true,
    onAction: fn().mockName('Get help'),
  },
] satisfies WithMenuProps['items'];

const meta = preview.meta({
  id: 'overlay-WithMenu',
  title: 'Overlay/WithMenu',
  component: WithMenu,
  args: {
    offset: 8,
    placement: 'top',
  },
  decorators: [OverlayTriggerDecorator],
});

export const Base = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    items: SampleItems,
  },
});

export const Showcase = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    items: ClassicMenu,
  },
});

export const Placements = meta.story({
  args: {
    children: <Trigger>ignored</Trigger>,
    items: SampleItems,
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
      <WithMenu {...args} placement="top">
        <Trigger>Top</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="top-start">
        <Trigger>Top Start</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="top-end">
        <Trigger>Top End</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="bottom">
        <Trigger>Bottom</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="bottom-start">
        <Trigger>Bottom Start</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="bottom-end">
        <Trigger>Bottom End</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="left">
        <Trigger>Left</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="left-start">
        <Trigger>Left Start</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="left-end">
        <Trigger>Left End</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="right">
        <Trigger>Right</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="right-start">
        <Trigger>Right Start</Trigger>
      </WithMenu>
      <WithMenu {...args} placement="right-end">
        <Trigger>Right End</Trigger>
      </WithMenu>
    </div>
  ),
});

export const CustomOffset = meta.story({
  args: {
    offset: 20,
    children: <Trigger>Click me!</Trigger>,
    items: SampleItems,
  },
});

export const AlwaysOpen = meta.story({
  args: {
    visible: true,
    children: <Trigger>Always visible tooltip</Trigger>,
    items: SampleItems,
    placement: 'right-start',
  },
  play: async () => {
    await expect(await screen.findByText('Lorem ipsum dolor sit')).toBeInTheDocument();
  },
});

export const NeverOpen = meta.story({
  args: {
    visible: false,
    children: <Trigger>Never visible tooltip</Trigger>,
    items: SampleItems,
    placement: 'right-start',
  },
  play: async () => {
    await expect(screen.queryByText('Lorem ipsum dolor sit')).not.toBeInTheDocument();
  },
});

export const WithVisibilityCallback = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    items: SampleItems,
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

export const InteractiveMenuKB = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    items: SampleItems,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText('Click me!');

    await step('Open menu', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      const firstItem = await screen.findByText('Lorem ipsum dolor sit amet');
      await expect(firstItem).toBeInTheDocument();
      await expect(firstItem).toHaveFocus();
    });

    const firstItem = await screen.findByText('Lorem ipsum dolor sit amet');
    const secondItem = await screen.findByText('Lorem ipsum dolor sit amet');

    await step('Pressing Tab does not move focus', async () => {
      await userEvent.tab();
      await expect(firstItem).toHaveFocus();
    });

    await step('Press ArrowDown and ArrowUp to navigate items', async () => {
      await userEvent.keyboard('{ArrowDown}');
      await expect(secondItem).toHaveFocus();

      await userEvent.keyboard('{ArrowUp}');
      await expect(firstItem).toHaveFocus();
    });

    await step('Press Esc to close items', async () => {
      await userEvent.keyboard('{Escape}');
      await expect(screen.queryByText('Lorem ipsum dolor sit amet')).not.toBeInTheDocument();
    });
  },
});

export const InteractiveMenuMouse = meta.story({
  args: {
    children: <Trigger>Click me!</Trigger>,
    items: SampleItems,
  },
  render: (args) => (
    <div>
      <WithMenu {...args} />
      <button>Sibling Button</button>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText('Click me!');

    await step('Open menu', async () => {
      await userEvent.click(trigger);
      await expect(screen.queryByText('Lorem ipsum dolor sit amet')).toBeInTheDocument();
    });

    await step('Click an item, closing the menu', async () => {
      await userEvent.click(await screen.findByText('Lorem ipsum dolor sit amet'));
      await expect(screen.queryByText('Lorem ipsum dolor sit amet')).not.toBeInTheDocument();
      await expect(trigger).toHaveFocus();
    });
  },
});
