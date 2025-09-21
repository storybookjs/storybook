import React from 'react';

import { TabletIcon } from '@storybook/icons';

import { expect, fn, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { SelectOption } from './SelectOption';
import { Listbox } from './helpers';

const meta = preview.meta({
  id: 'select-option-component',
  title: 'SelectOption',
  component: SelectOption,
  args: {
    id: 'tablet',
    title: 'Tablet',
    icon: <TabletIcon />,
    isSelected: false,
    isActive: false,
    shouldLookDisabled: false,
    onClick: fn(),
    onFocus: fn(),
    onKeyDown: fn(),
  },
  decorators: [
    (Story) => (
      <Listbox
        aria-label="Sample listbox"
        role="listbox"
        style={{ width: '200px', border: '1px solid #888' }}
      >
        <Story />
      </Listbox>
    ),
  ],
});

export const Base = meta.story({ args: {} });

export const WithDescription = meta.story({
  args: { description: 'Handheld device' },
});

export const WithChildren = meta.story({
  args: {
    children: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>🔥</span>
        <span>Custom children</span>
      </div>
    ),
    id: undefined,
  },
});

export const PseudoStates = meta.story({
  render: (args) => (
    <>
      <SelectOption {...args} id="inactive">
        Inactive
      </SelectOption>
      <SelectOption {...args} id="hover" data-state="hover">
        Hover
      </SelectOption>
      <SelectOption {...args} id="focus" data-state="focus">
        Focus
      </SelectOption>
      <SelectOption {...args} id="sep1" shouldLookDisabled>
        ---------
      </SelectOption>
      <SelectOption {...args} id="inactive-selected" isSelected>
        Inactive Selected
      </SelectOption>
      <SelectOption {...args} id="hover-selected" data-state="hover" isSelected>
        Hover Selected
      </SelectOption>
      <SelectOption {...args} id="focus-selected" data-state="focus" isSelected>
        Focus Selected
      </SelectOption>
      <SelectOption {...args} id="sep2" shouldLookDisabled>
        ---------
      </SelectOption>
      <SelectOption {...args} id="inactive-disabled" shouldLookDisabled>
        Inactive Disabled
      </SelectOption>
      <SelectOption {...args} id="hover-disabled" data-state="hover" shouldLookDisabled>
        Hover Disabled
      </SelectOption>
      <SelectOption {...args} id="focus-disabled" data-state="focus" shouldLookDisabled>
        Focus Disabled
      </SelectOption>
    </>
  ),
  parameters: {
    pseudo: {
      hover: '[data-state="hover"]',
      focus: '[data-state="focus"]',
      focusVisible: '[data-state="focus"]',
    },
  },
});

export const Active = meta.story({
  args: { isActive: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('option');
    await expect(option).toHaveAttribute('tabindex', '0');
  },
});

export const Selected = meta.story({
  args: { isSelected: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('option');
    await expect(option).toHaveAttribute('aria-selected', 'true');
  },
});
export const SelectedActive = meta.story({
  args: { isSelected: true, isActive: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('option');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(option).toHaveAttribute('tabindex', '0');
  },
});

export const Disabled = meta.story({
  args: { shouldLookDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('option');
    await expect(option).toHaveAttribute('aria-disabled', 'true');
  },
});

export const SelectedDisabled = meta.story({
  args: { isSelected: true, shouldLookDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('option');
    await expect(option).toHaveAttribute('aria-disabled', 'true');
    await expect(option).toHaveAttribute('aria-selected', 'true');
  },
});

export const SelectedDisabledActive = meta.story({
  args: { isSelected: true, shouldLookDisabled: true, isActive: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('option');
    await expect(option).toHaveAttribute('aria-disabled', 'true');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(option).toHaveAttribute('tabindex', '0');
  },
});
