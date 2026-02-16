import React from 'react';

import { Button, Toolbar } from 'storybook/internal/components';

import { LinuxIcon } from '@storybook/icons';

import type { StoryAnnotations } from 'core/src/types';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { Select } from './Select';

const meta = preview.meta({
  id: 'select-component',
  title: 'Select',
  component: Select,
  args: {
    ariaLabel: 'Animal',
    children: 'Animal',
    icon: <LinuxIcon />,
    onChange: fn(),
    onSelect: fn(),
    onDeselect: fn(),
    options: [
      { title: 'Tadpole', value: 'tadpole' },
      { title: 'Pollywog', value: 'pollywog' },
      { title: 'Frog', value: 'frog' },
    ],
  },
  tags: ['!vitest'],
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const Base = meta.story({});

export const Sizes = meta.story({
  render: (args) => (
    <Stack>
      <Row>
        <Select size="small" {...args}>
          Small
        </Select>
        <Select size="medium" {...args}>
          Medium
        </Select>
      </Row>
    </Stack>
  ),
});

export const Paddings = meta.story({
  render: (args) => (
    <Stack>
      <Row>
        <Select padding="none" {...args}>
          No Padding
        </Select>
        <Select padding="small" {...args}>
          Small Padding
        </Select>
        <Select padding="medium" {...args}>
          Medium Padding
        </Select>
      </Row>
    </Stack>
  ),
});

export const PseudoStates = meta.story({
  args: {
    options: [{ title: 'Frog', value: 'frog' }],
  },
  render: (args) => (
    <Stack>
      <Row style={{ marginBlock: '4rem' }}>
        <h4>Inactive</h4>
        <Select {...args}>Unset</Select>
        <Select {...args} defaultOptions={['frog']}>
          Set
        </Select>
        <Select {...args} defaultOptions={['frog']} disabled>
          Override
        </Select>
        <Select {...args} defaultOpen>
          Open
        </Select>
      </Row>
      <Row className="hover" style={{ marginBlock: '4rem' }}>
        <h4>Hover</h4>
        <Select {...args}>Unset</Select>
        <Select {...args} defaultOptions={['frog']}>
          Set
        </Select>
        <Select {...args} defaultOptions={['frog']} disabled>
          Override
        </Select>
        <Select {...args} defaultOpen>
          Open
        </Select>
      </Row>
      <Row className="focus" style={{ marginBlock: '4rem' }}>
        <h4>Focus</h4>
        <Select {...args}>Unset</Select>
        <Select {...args} defaultOptions={['frog']}>
          Set
        </Select>
        <Select {...args} defaultOptions={['frog']} disabled>
          Override
        </Select>
        <Select {...args} defaultOpen>
          Open
        </Select>
      </Row>
    </Stack>
  ),
  parameters: {
    pseudo: {
      hover: '.hover button',
      focus: '.focus button',
      focusVisible: '.focus button',
      active: '.active button',
    },
  },
});

export const ManyOptions = meta.story({
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      title: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
});

export const LongOptionLabels = meta.story({
  name: 'Long Option Labels',
  args: {
    children: 'Long labels',
    options: [
      {
        title: 'This is a very long option label that might cause wrapping issues',
        value: 'long1',
      },
      {
        title:
          'Another extremely long option label that tests how the component handles overflow, and if you think that is too long, you may well be justified in thinking so, albeit it is a test case',
        value: 'long2',
      },
      { title: 'Short', value: 'short' },
    ],
  },
});

export const CustomOptionRendering = meta.story({
  name: 'Custom Option Rendering',
  args: {
    children: 'Custom options',
    options: [
      {
        title: 'Tadpole',
        value: 'tadpole',
        children: (
          <>
            <strong>1. </strong> 👶 Tadpole
          </>
        ),
      },
      {
        title: 'Pollywog',
        value: 'pollywog',
        children: (
          <>
            <strong>2. </strong> 👧 Pollywog
          </>
        ),
      },
      {
        title: 'Frog',
        value: 'frog',
        children: (
          <>
            <strong>3. </strong> 🐸 Frog
          </>
        ),
      },
    ],
  },
});

export const WithSiblings = meta.story({
  render: (args) => (
    <Row>
      <Button ariaLabel={false}>Before</Button>
      <Select {...args} />
      <Button ariaLabel={false}>After</Button>
    </Row>
  ),
  play: async ({ canvas, step }) => {
    const user = userEvent.setup();

    await step('Open select and select an option', async () => {
      const select = canvas.getByRole('button', { name: /Animal/i });
      await user.click(select);

      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();

      const option = within(listbox).getByRole('option', { name: 'Frog' });
      await user.click(option);
    });

    await step('Tab should land on sibling after select', async () => {
      const select = canvas.getByRole('button', { name: /Frog/i });
      expect(select).toHaveFocus();

      await user.tab();

      const afterButton = canvas.getByRole('button', { name: 'After' });
      expect(afterButton).toHaveFocus();
    });

    await step('Navigate back and reopen select', async () => {
      await user.tab({ shift: true });

      const select = canvas.getByRole('button', { name: /Frog/i });
      expect(select).toHaveFocus();

      await user.keyboard('{Enter}');

      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
    });

    await step('Escape should return to select trigger', async () => {
      await user.keyboard('{Escape}');

      const select = canvas.getByRole('button', { name: /Frog/i });
      expect(select).toHaveFocus();
    });
  },
});

export const WithSiblingsInToolbar = meta.story({
  name: 'With Siblings in Toolbar',
  render: (args) => (
    <Toolbar aria-label="Test toolbar">
      <Button ariaLabel="Before button">Before</Button>
      <Select {...args} />
      <Button ariaLabel="After button">After</Button>
    </Toolbar>
  ),
  play: async ({ canvas, step }) => {
    const user = userEvent.setup();

    await step('Navigate to select with ArrowRight', async () => {
      const beforeButton = canvas.getByRole('button', { name: 'Before button' });
      beforeButton.focus();
      expect(beforeButton).toHaveFocus();

      await user.keyboard('{ArrowRight}');

      const select = canvas.getByRole('button', { name: /Animal/i });
      expect(select).toHaveFocus();
    });

    await step('Open select and select an option', async () => {
      await user.keyboard('{Enter}');

      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();

      const option = within(listbox).getByRole('option', { name: 'Frog' });
      await user.click(option);
    });

    await step('ArrowRight should land on sibling after select', async () => {
      const select = canvas.getByRole('button', { name: /Frog/i });
      expect(select).toHaveFocus();

      await user.keyboard('{ArrowRight}');

      const afterButton = canvas.getByRole('button', { name: 'After button' });
      expect(afterButton).toHaveFocus();
    });

    await step('Navigate back with ArrowLeft and reopen select', async () => {
      await user.keyboard('{ArrowLeft}');

      const select = canvas.getByRole('button', { name: /Frog/i });
      expect(select).toHaveFocus();

      await user.keyboard('{Enter}');

      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
    });

    await step('Escape should return to select trigger', async () => {
      await user.keyboard('{Escape}');

      const select = canvas.getByRole('button', { name: /Frog/i });
      expect(select).toHaveFocus();
    });
  },
});

export const DefaultOption = meta.story({
  name: 'Default Option (single)',
  args: {
    defaultOptions: 'frog',
  },
});

export const DefaultOptionMulti = meta.story({
  name: 'Default Option (multi)',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole', 'frog'],
  },
});

const disabledPlayFn: StoryAnnotations['play'] = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const selectButton = await canvas.findByRole('button');
  expect(selectButton).toHaveAttribute('aria-disabled', 'true');

  await userEvent.click(selectButton);
  expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
  expect(args.onSelect).not.toHaveBeenCalled();
  expect(args.onChange).not.toHaveBeenCalled();
};

export const Disabled = meta.story({
  args: {
    disabled: true,
  },
  play: disabledPlayFn,
});

export const DisabledWithSelection = meta.story({
  name: 'Disabled with selection (single)',
  args: {
    disabled: true,
    defaultOptions: 'frog',
  },
  play: disabledPlayFn,
});

export const DisabledWithSelectionMulti = meta.story({
  name: 'Disabled with selection (multi)',
  args: {
    disabled: true,
    multiSelect: true,
    defaultOptions: ['tadpole', 'frog'],
  },
  play: disabledPlayFn,
});

export const DefaultOpen = meta.story({
  args: {
    defaultOpen: true,
  },
});

export const MouseSelection = meta.story({
  name: 'Mouse Selection (single)',
  play: async ({ canvas, args }) => {
    const selectButton = await canvas.findByRole('button');
    await userEvent.click(selectButton);

    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const pollywogOption = await screen.findByRole('option', { name: 'Pollywog' });
    await userEvent.click(pollywogOption);

    expect(args.onSelect).toHaveBeenCalledWith('pollywog');
    expect(args.onChange).toHaveBeenCalledWith(['pollywog']);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await expect(selectButton).toHaveTextContent('Pollywog');
  },
});

export const MouseSelectionMulti = meta.story({
  name: 'Mouse Selection (multi)',
  args: {
    multiSelect: true,
  },
  render: (args) => (
    <Row>
      <Select {...args} />
      <Button ariaLabel={false}>Other content</Button>
    </Row>
  ),
  play: async ({ canvas, args }) => {
    const selectButton = await canvas.findByRole('button', { name: /Animal/ });
    await userEvent.click(selectButton);

    const tadpoleOption = await screen.findByRole('option', { name: 'Tadpole' });
    await userEvent.click(tadpoleOption);

    expect(args.onSelect).toHaveBeenCalledWith('tadpole');
    expect(args.onChange).toHaveBeenCalledWith(['tadpole']);
    expect(selectButton).toHaveTextContent('1');
    expect(await screen.findByRole('listbox')).toBeInTheDocument(); // Listbox should not close in multi select mode.

    const pollywogOption = await screen.findByRole('option', { name: 'Pollywog' });
    await userEvent.click(pollywogOption);

    expect(args.onChange).toHaveBeenLastCalledWith(['tadpole', 'pollywog']);
    expect(selectButton).toHaveTextContent('2');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    await userEvent.click(await canvas.findByText('Other content'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); // Now closed.
  },
});

const kbSelectionTest =
  (triggerKey: string, selectKey: string): StoryAnnotations['play'] =>
  async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();

    await step('Open listbox', async () => {
      await userEvent.keyboard(triggerKey);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const optionOne = await screen.findByRole('option', { name: 'Tadpole' });
      expect(document.activeElement).toBe(optionOne);
    });

    await step('Press ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      const optionTwo = await screen.findByRole('option', { name: 'Pollywog' });
      expect(document.activeElement).toBe(optionTwo);
    });

    await step('Select active option (closes the Select)', async () => {
      await userEvent.keyboard(selectKey);
      expect(args.onSelect).toHaveBeenCalledWith('pollywog');
      expect(args.onChange).toHaveBeenCalledWith(['pollywog']);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(selectButton).toHaveTextContent('Pollywog');
    });
  };

export const KeyboardSelectionEE = meta.story({
  name: 'KB Selection (single, Enter, Enter)',
  play: kbSelectionTest('{Enter}', '{Enter}'),
});

export const KeyboardSelectionES = meta.story({
  name: 'KB Selection (single, Enter, Space)',
  play: kbSelectionTest('{Enter}', ' '),
});

export const KeyboardSelectionSE = meta.story({
  name: 'KB Selection (single, Space, Enter)',
  play: kbSelectionTest(' ', '{Enter}'),
});

export const KeyboardSelectionSS = meta.story({
  name: 'KB Selection (single, Space, Space)',
  play: kbSelectionTest(' ', ' '),
});

const kbMultiSelectionTest =
  (triggerKey: string, selectKey: string): StoryAnnotations['play'] =>
  async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button', { name: /Animal/ });
    selectButton.focus();

    await step('Open listbox', async () => {
      await userEvent.keyboard(triggerKey);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const optionOne = await screen.findByRole('option', { name: 'Tadpole' });
      expect(document.activeElement).toBe(optionOne);
    });

    await step('Select option one', async () => {
      await userEvent.keyboard(selectKey);
      expect(args.onSelect).toHaveBeenCalledWith('tadpole');
      expect(args.onChange).toHaveBeenCalledWith(['tadpole']);
      expect(screen.queryByRole('listbox')).toBeInTheDocument();
    });

    await step('Press ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      const optionTwo = await screen.findByRole('option', { name: 'Pollywog' });
      expect(document.activeElement).toBe(optionTwo);
    });

    await step('Select option two', async () => {
      await userEvent.keyboard(selectKey);
      expect(args.onSelect).toHaveBeenCalledWith('pollywog');
      expect(args.onChange).toHaveBeenCalledWith(['tadpole', 'pollywog']);
      expect(screen.queryByRole('listbox')).toBeInTheDocument();
      expect(selectButton).toHaveTextContent('2');
    });

    await step('Tab away (closes the Select)', async () => {
      await userEvent.keyboard('{Tab}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  };

export const KeyboardSelectionMultiEE = meta.story({
  name: 'KB Selection (multi, Enter, Enter)',
  args: { multiSelect: true },
  play: kbMultiSelectionTest('{Enter}', '{Enter}'),
});

export const KeyboardSelectionMultiES = meta.story({
  name: 'KB Selection (multi, Enter, Space)',
  args: { multiSelect: true },
  play: kbMultiSelectionTest('{Enter}', ' '),
});

export const KeyboardSelectionMultiSE = meta.story({
  name: 'KB Selection (multi, Space, Enter)',
  args: { multiSelect: true },
  play: kbMultiSelectionTest(' ', '{Enter}'),
});

export const KeyboardSelectionMultiSS = meta.story({
  name: 'KB Selection (multi, Space, Space)',
  args: { multiSelect: true },
  play: kbMultiSelectionTest(' ', ' '),
});

export const FullArrowNavigation = meta.story({
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');
    await step('Open select', async () => {
      selectButton.focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(selectButton).toHaveTextContent('Tadpole');
    });

    await step('Navigate to option 2 with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      expect(selectButton).toHaveTextContent('Pollywog');
    });

    await step('Navigate to option 3 with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      expect(selectButton).toHaveTextContent('Frog');
    });

    await step('Loop back to option 1 with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      expect(selectButton).toHaveTextContent('Tadpole');
    });

    await step('Navigate backwards with ArrowUp', async () => {
      await userEvent.keyboard('{ArrowUp}');
      expect(selectButton).toHaveTextContent('Frog');
    });

    await step('Navigate backwards with ArrowUp', async () => {
      await userEvent.keyboard('{ArrowUp}');
      expect(selectButton).toHaveTextContent('Pollywog');
    });

    await step('Navigate back to option 1 with ArrowUp', async () => {
      await userEvent.keyboard('{ArrowUp}');
      expect(selectButton).toHaveTextContent('Tadpole');
    });
  },
});

export const MouseOpenNoAutoselect = meta.story({
  name: 'AutoSelect - nothing selected on Mouse open (single)',
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Click on button', async () => {
      await userEvent.click(selectButton);
      expect(screen.queryByRole('listbox')).toBeInTheDocument();
      expect(args.onSelect).not.toHaveBeenCalled();
      expect(args.onChange).not.toHaveBeenCalled();
      expect(selectButton).not.toHaveTextContent('Tadpole');
    });

    await step('Click again to close', async () => {
      await userEvent.click(selectButton);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(args.onSelect).not.toHaveBeenCalled();
      expect(args.onChange).not.toHaveBeenCalled();
      expect(selectButton).not.toHaveTextContent('Tadpole');
    });
  },
});

export const KeyboardOpenAutoselect = meta.story({
  name: 'AutoSelect - first item select on Enter (single)',
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Open with Enter', async () => {
      selectButton.focus();
      await userEvent.keyboard('{Enter}');
    });

    await step('Validate the first item was selected', async () => {
      expect(args.onSelect).toHaveBeenCalledWith('tadpole');
      expect(args.onChange).toHaveBeenCalledWith(['tadpole']);
      expect(selectButton).toHaveTextContent('Tadpole');
    });

    await step('Close button with Escape', async () => {
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    await step('Validate the first item is still selected', async () => {
      expect(args.onSelect).toHaveBeenCalledWith('tadpole');
      expect(args.onChange).toHaveBeenCalledWith(['tadpole']);
      expect(selectButton).toHaveTextContent('Tadpole');
    });
  },
});

export const ArrowDownAutoSelect = meta.story({
  name: 'AutoSelect - first item select on ArrowDown (single)',
  play: async ({ canvas, args }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onSelect).toHaveBeenCalledWith('tadpole');
    expect(args.onChange).toHaveBeenCalledWith(['tadpole']);
    expect(selectButton).toHaveTextContent('Tadpole');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  },
});

export const ArrowUpAutoSelect = meta.story({
  name: 'AutoSelect - last item select on ArrowUp (single)',
  play: async ({ canvas, args }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(args.onSelect).toHaveBeenCalledWith('frog');
    expect(args.onChange).toHaveBeenCalledWith(['frog']);
    expect(selectButton).toHaveTextContent('Frog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  },
});

export const MouseFastNavPage = meta.story({
  name: 'Mouse Open - PageUp/Down',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      title: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Open select (no active option)', async () => {
      await userEvent.click(selectButton);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(document.activeElement).toBe(listbox);
    });

    await step('Press PageDown (6th option is active)', async () => {
      await userEvent.keyboard('{PageDown}');
      const sixthOption = await screen.findByRole('option', { name: 'Option 6' });
      expect(document.activeElement).toBe(sixthOption);
    });

    await step('Press PageUp (1st option is active)', async () => {
      await userEvent.keyboard('{PageUp}');
      const firstOption = await screen.findByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});
export const KeyboardFastNavPage = meta.story({
  name: 'KB Open - PageUp/Down',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      title: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();

    await step('Open select (1st option is active)', async () => {
      await userEvent.keyboard('{Enter}');
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const firstOption = await screen.findByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });

    await step('Press PageDown (6th option is active)', async () => {
      await userEvent.keyboard('{PageDown}');
      const sixthOption = await screen.findByRole('option', { name: 'Option 6' });
      expect(document.activeElement).toBe(sixthOption);
    });

    await step('Press PageUp (1st option is active)', async () => {
      await userEvent.keyboard('{PageUp}');
      const firstOption = await screen.findByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});

export const MouseFastNavHomeEnd = meta.story({
  name: 'Mouse Open - Home/End',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      title: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Open select (no active option)', async () => {
      await userEvent.click(selectButton);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(document.activeElement).toBe(listbox);
    });

    await step('Navigate to middle with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      const middleOption = await screen.findByRole('option', { name: 'Option 3' });
      expect(document.activeElement).toBe(middleOption);
    });

    await step('Navigate to end with End', async () => {
      await userEvent.keyboard('{End}');
      const lastOption = await screen.findByRole('option', { name: 'Option 20' });
      expect(document.activeElement).toBe(lastOption);
    });

    await step('Navigate to start with Home', async () => {
      await userEvent.keyboard('{Home}');
      const firstOption = await screen.findByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});

export const KeyboardFastNavHomeEnd = meta.story({
  name: 'KB Open - Home/End',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      title: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();

    await step('Open select (1st option is active)', async () => {
      await userEvent.keyboard('{Enter}');
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const firstOption = await screen.findByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });

    await step('Navigate to middle with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      const middleOption = await screen.findByRole('option', { name: 'Option 4' });
      expect(document.activeElement).toBe(middleOption);
    });

    await step('Navigate to end with End', async () => {
      await userEvent.keyboard('{End}');
      const lastOption = await screen.findByRole('option', { name: 'Option 20' });
      expect(document.activeElement).toBe(lastOption);
    });

    await step('Navigate to start with Home', async () => {
      await userEvent.keyboard('{Home}');
      const firstOption = await screen.findByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});

export const MouseDeselection = meta.story({
  name: 'Mouse Deselection (multi)',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole', 'pollywog'],
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button', { name: /Animal/ });

    await step('Check initial state', async () => {
      expect(selectButton).toHaveTextContent('2');
    });

    await step('Open select', async () => {
      await userEvent.click(selectButton);
    });

    await step('Deselect first option', async () => {
      const tadpoleOption = await screen.findByRole('option', { name: 'Tadpole' });
      expect(tadpoleOption).toHaveAttribute('aria-selected', 'true');
      await userEvent.click(tadpoleOption);
      expect(args.onDeselect).toHaveBeenCalledWith('tadpole');
      expect(args.onChange).toHaveBeenCalledWith(['pollywog']);
    });

    await step('Check final state', async () => {
      expect(selectButton).toHaveTextContent('1');
    });
  },
});

export const KeyboardDeselection = meta.story({
  name: 'KB Deselection (multi)',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole', 'pollywog'],
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button', { name: /Animal/ });

    await step('Check initial state', async () => {
      expect(selectButton).toHaveTextContent('2');
    });

    await step('Open select', async () => {
      selectButton.focus();
      await userEvent.keyboard('{Enter}');
    });

    await step('Deselect first option', async () => {
      const tadpoleOption = await screen.findByRole('option', { name: 'Tadpole' });
      expect(tadpoleOption).toHaveAttribute('aria-selected', 'true');
      await userEvent.keyboard('{Enter}');
      expect(args.onDeselect).toHaveBeenCalledWith('tadpole');
      expect(args.onChange).toHaveBeenCalledWith(['pollywog']);
    });

    await step('Tab away (closes the Select)', async () => {
      await userEvent.keyboard('{Tab}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    await step('Check final state', async () => {
      expect(selectButton).toHaveTextContent('1');
    });
  },
});

export const OnSelectHandler = meta.story({
  name: 'Handlers - onSelect',
  args: {
    onSelect: fn().mockName('onSelect'),
  },
  play: async ({ canvas, args }) => {
    const selectButton = await canvas.findByRole('button');

    await userEvent.click(selectButton);

    const frogOption = await screen.findByRole('option', { name: 'Frog' });
    await userEvent.click(frogOption);

    expect(args.onSelect).toHaveBeenCalledTimes(1);
    expect(args.onSelect).toHaveBeenCalledWith('frog');
  },
});

export const OnDeselectHandler = meta.story({
  name: 'Handlers - onDeselect',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole'],
    onDeselect: fn().mockName('onDeselect'),
  },
  play: async ({ canvas, args }) => {
    const selectButton = await canvas.findByRole('button', { name: /Animal/ });
    await userEvent.click(selectButton);

    const tadpoleOption = await screen.findByRole('option', { name: 'Tadpole' });
    await userEvent.click(tadpoleOption);

    expect(args.onDeselect).toHaveBeenCalledTimes(1);
    expect(args.onDeselect).toHaveBeenCalledWith('tadpole');
  },
});

export const OnChangeHandler = meta.story({
  name: 'Handlers - onChange',
  args: {
    multiSelect: true,
    onChange: fn().mockName('onChange'),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button', { name: /Animal/ });

    await step('Open select', async () => {
      await userEvent.click(selectButton);
    });

    await step('Select first option', async () => {
      const tadpoleOption = await screen.findByRole('option', { name: 'Tadpole' });
      await userEvent.click(tadpoleOption);
      expect(args.onChange).toHaveBeenCalledWith(['tadpole']);
    });

    await step('Select second option', async () => {
      const frogOption = await screen.findByRole('option', { name: 'Frog' });
      await userEvent.click(frogOption);
      expect(args.onChange).toHaveBeenLastCalledWith(['tadpole', 'frog']);
    });
  },
});

export const WithResetSingle = meta.story({
  name: 'With Reset (single)',
  args: {
    defaultOptions: 'frog',
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Check initial state', async () => {
      expect(selectButton).toHaveTextContent('Frog');
    });

    await step('Open select', async () => {
      await userEvent.click(selectButton);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await step('Check Reset option exists', async () => {
      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(resetOption).toBeInTheDocument();
    });

    await step('Click Reset', async () => {
      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      await userEvent.click(resetOption);

      expect(args.onReset).toHaveBeenCalledTimes(1);
      expect(args.onChange).toHaveBeenCalledWith([]);
      expect(selectButton).not.toHaveTextContent('Frog');
      expect(selectButton).not.toHaveTextContent('Tadpole');
      expect(selectButton).not.toHaveTextContent('Pollywog');
    });
  },
});

export const WithResetMulti = meta.story({
  name: 'With Reset (multi)',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole', 'frog'],
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Check initial state', async () => {
      expect(selectButton).toHaveTextContent('2');
    });

    await step('Open select', async () => {
      await userEvent.click(selectButton);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await step('Check Reset option exists', async () => {
      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(resetOption).toBeInTheDocument();
    });

    await step('Click Reset', async () => {
      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      await userEvent.click(resetOption);

      expect(args.onReset).toHaveBeenCalledTimes(1);
      expect(args.onChange).toHaveBeenCalledWith([]);
      expect(selectButton).not.toHaveTextContent('2');
    });
  },
});

export const KeyboardResetSingle = meta.story({
  name: 'KB Reset (single, focus)',
  args: {
    defaultOptions: 'frog',
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();

    await step('Open with Enter and navigate to reset option', async () => {
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard('{Home}');

      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(document.activeElement).toBe(resetOption);
    });

    await step('Check Select is reset', async () => {
      expect(args.onReset).toHaveBeenCalledTimes(1);
      expect(args.onChange).toHaveBeenCalledWith([]);
      expect(selectButton).not.toHaveTextContent('Frog');
      expect(selectButton).not.toHaveTextContent('Tadpole');
      expect(selectButton).not.toHaveTextContent('Pollywog');
    });
  },
});

export const KeyboardResetMulti = meta.story({
  name: 'KB Reset (multi, Enter)',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole', 'frog'],
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();

    await step('Open with Enter and navigate to reset option', async () => {
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard('{Home}');

      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(document.activeElement).toBe(resetOption);
    });

    await step('Press Enter to reset', async () => {
      await userEvent.keyboard('{Enter}');

      expect(args.onReset).toHaveBeenCalledTimes(1);
      expect(args.onChange).toHaveBeenCalledWith([]);
      expect(selectButton).not.toHaveTextContent('2');

      expect(await screen.findByRole('listbox')).toBeInTheDocument();
    });

    await step('Close with Escape', async () => {
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  },
});

export const KeyboardResetMultiSpace = meta.story({
  name: 'KB Reset (multi, Space)',
  args: {
    multiSelect: true,
    defaultOptions: ['tadpole', 'frog'],
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');
    selectButton.focus();

    await step('Open with Space and navigate to reset option', async () => {
      await userEvent.keyboard(' ');
      await userEvent.keyboard('{Home}');

      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(document.activeElement).toBe(resetOption);
    });

    await step('Press Space to reset', async () => {
      await userEvent.keyboard(' ');

      expect(args.onReset).toHaveBeenCalledTimes(1);
      expect(args.onChange).toHaveBeenCalledWith([]);
      expect(selectButton).not.toHaveTextContent('2');

      expect(await screen.findByRole('listbox')).toBeInTheDocument();
    });

    await step('Close with Escape', async () => {
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  },
});

export const ResetButtonVisibilitySingle = meta.story({
  name: 'Reset Button Visibility (single)',
  args: {
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Open without selection', async () => {
      await userEvent.click(selectButton);

      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(resetOption).toBeInTheDocument();
      // Reset option should not be disabled when the user cursor is on it in
      // single-select mode even without selection, because single-select Select
      // auto triggers the focused option, and we don't want to have the selection
      // reset whilst SRs announce that the reset option is disabled.
      expect(resetOption).not.toHaveAttribute('aria-disabled', 'true');
    });

    await step('Select an option', async () => {
      const frogOption = await screen.findByRole('option', { name: 'Frog' });
      await userEvent.click(frogOption);
    });

    await step('Reopen select and check reset option', async () => {
      await userEvent.click(selectButton);

      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(resetOption).toBeInTheDocument();
      expect(resetOption).not.toHaveAttribute('aria-disabled', 'true');
    });
  },
});

export const ResetButtonVisibilityMulti = meta.story({
  name: 'Reset Button Visibility (multi)',
  args: {
    multiSelect: true,
    onReset: fn().mockName('onReset'),
  },
  play: async ({ canvas, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Open without selection', async () => {
      await userEvent.click(selectButton);

      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(resetOption).toBeInTheDocument();
      expect(resetOption).toHaveAttribute('aria-disabled', 'true');
    });

    await step('Select an option', async () => {
      const frogOption = await screen.findByRole('option', { name: 'Frog' });
      await userEvent.click(frogOption);
    });

    await step('Check reset option', async () => {
      const resetOption = await screen.findByRole('option', { name: 'Reset selection' });
      expect(resetOption).toBeInTheDocument();
      expect(resetOption).not.toHaveAttribute('aria-disabled', 'true');
    });
  },
});

export const CustomResetLabel = meta.story({
  name: 'Custom Reset Label',
  args: {
    defaultOptions: 'frog',
    onReset: fn().mockName('onReset'),
    resetLabel: 'Clear selection',
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');

    await userEvent.click(selectButton);

    const resetOption = await screen.findByRole('option', { name: 'Clear selection' });
    expect(resetOption).toBeInTheDocument();
  },
});

export const WithoutReset = meta.story({
  name: 'Without Reset Option',
  args: {
    defaultOptions: 'frog',
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');

    await userEvent.click(selectButton);

    const options = await screen.findAllByRole('option');
    for (const option of options) {
      expect(option).not.toHaveTextContent('Reset selection');
    }

    expect(options.length).toBe(3);
  },
});

const nonStringOptions = [
  { title: 'Number (42)', value: 42 },
  { title: 'Number (0)', value: 0 },
  { title: 'Boolean (true)', value: true },
  { title: 'Boolean (false)', value: false },
  { title: 'Null', value: null },
  { title: 'Undefined', value: undefined },
  { title: 'String', value: 'string' },
];

export const NonStringValuesSingleSelect = meta.story({
  name: 'Non-String Values (single)',
  args: {
    options: nonStringOptions,
    onSelect: fn(),
    onChange: fn(),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Select number value (42)', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Number (42)' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(42);
      expect(args.onChange).toHaveBeenLastCalledWith([42]);
    });

    await step('Select boolean value (true)', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Boolean (true)' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(true);
      expect(args.onChange).toHaveBeenLastCalledWith([true]);
    });

    await step('Select boolean value (false)', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Boolean (false)' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(false);
      expect(args.onChange).toHaveBeenLastCalledWith([false]);
    });

    await step('Select null value', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Null' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(null);
      expect(args.onChange).toHaveBeenLastCalledWith([null]);
    });

    await step('Select undefined value', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Undefined' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(undefined);
      expect(args.onChange).toHaveBeenLastCalledWith([undefined]);
    });

    await step('Select number value (0 - falsy)', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Number (0)' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(0);
      expect(args.onChange).toHaveBeenLastCalledWith([0]);
    });
  },
});

export const NonStringValuesMultiSelect = meta.story({
  name: 'Non-String Values (multi)',
  args: {
    options: nonStringOptions,
    multiSelect: true,
    onSelect: fn(),
    onDeselect: fn(),
    onChange: fn(),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Select number (42)', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Number (42)' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(42);
      expect(args.onChange).toHaveBeenLastCalledWith([42]);
    });

    await step('Add boolean (true)', async () => {
      await userEvent.click(await screen.findByRole('option', { name: 'Boolean (true)' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(true);
      expect(args.onChange).toHaveBeenLastCalledWith([42, true]);
    });

    await step('Add null', async () => {
      await userEvent.click(await screen.findByRole('option', { name: 'Null' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(null);
      expect(args.onChange).toHaveBeenLastCalledWith([42, true, null]);
    });

    await step('Add undefined', async () => {
      await userEvent.click(await screen.findByRole('option', { name: 'Undefined' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(undefined);
      expect(args.onChange).toHaveBeenLastCalledWith([42, true, null, undefined]);
    });

    await step('Deselect number (42)', async () => {
      await userEvent.click(await screen.findByRole('option', { name: 'Number (42)' }));
      expect(args.onDeselect).toHaveBeenLastCalledWith(42);
      expect(args.onChange).toHaveBeenLastCalledWith([true, null, undefined]);
    });

    await step('Deselect undefined', async () => {
      await userEvent.click(await screen.findByRole('option', { name: 'Undefined' }));
      expect(args.onDeselect).toHaveBeenLastCalledWith(undefined);
      expect(args.onChange).toHaveBeenLastCalledWith([true, null]);
    });
  },
});

export const DefaultOptionNumber = meta.story({
  name: 'Default Option - Number',
  args: {
    options: nonStringOptions,
    defaultOptions: 42,
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Number (42)');
  },
});

export const DefaultOptionZero = meta.story({
  name: 'Default Option - Zero',
  args: {
    options: nonStringOptions,
    defaultOptions: 0,
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Number (0)');
  },
});

export const DefaultOptionBooleanTrue = meta.story({
  name: 'Default Option - Boolean True',
  args: {
    options: nonStringOptions,
    defaultOptions: true,
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Boolean (true)');
  },
});

export const DefaultOptionBooleanFalse = meta.story({
  name: 'Default Option - Boolean False',
  args: {
    options: nonStringOptions,
    defaultOptions: false,
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Boolean (false)');
  },
});

export const DefaultOptionNull = meta.story({
  name: 'Default Option - Null',
  args: {
    options: nonStringOptions,
    defaultOptions: null,
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Null');
  },
});

export const DefaultOptionUndefinedDoesNotWork = meta.story({
  name: 'Default Option - Bare undefined does NOT select',
  args: {
    options: nonStringOptions,
    defaultOptions: undefined,
    children: 'Nothing selected',
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Nothing selected');
    await expect(selectButton).not.toHaveTextContent('Undefined');
  },
});

export const DefaultOptionUndefinedInArrayWorks = meta.story({
  name: 'Default Option - [undefined] selects undefined option',
  args: {
    options: nonStringOptions,
    defaultOptions: [undefined],
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('Undefined');
  },
});

export const DefaultOptionsMultipleNonStringValues = meta.story({
  name: 'Default Options - Multiple Non-String Values',
  args: {
    options: nonStringOptions,
    defaultOptions: [42, false, null],
    multiSelect: true,
  },
  play: async ({ canvas }) => {
    const selectButton = await canvas.findByRole('button');
    await expect(selectButton).toHaveTextContent('3');

    await userEvent.click(selectButton);
    const option42 = await screen.findByRole('option', { name: 'Number (42)' });
    const optionFalse = await screen.findByRole('option', { name: 'Boolean (false)' });
    const optionNull = await screen.findByRole('option', { name: 'Null' });

    expect(option42).toHaveAttribute('aria-selected', 'true');
    expect(optionFalse).toHaveAttribute('aria-selected', 'true');
    expect(optionNull).toHaveAttribute('aria-selected', 'true');
  },
});

const optionsWithUndefinedForReset = [
  { title: 'Apple', value: 'apple' },
  { title: 'Undefined Value', value: undefined },
  { title: 'Banana', value: 'banana' },
];

export const ResetWithUndefinedOption = meta.story({
  name: 'Reset vs Undefined Option',
  args: {
    options: optionsWithUndefinedForReset,
    children: 'Select fruit',
    onReset: fn(),
    onChange: fn(),
    onSelect: fn(),
  },
  play: async ({ canvas, args, step }) => {
    const selectButton = await canvas.findByRole('button');

    await step('Select a regular option first', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Apple' }));
      expect(args.onSelect).toHaveBeenLastCalledWith('apple');
      expect(args.onChange).toHaveBeenLastCalledWith(['apple']);
      await expect(selectButton).toHaveTextContent('Apple');
    });

    await step('Select the undefined value option - it should work', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Undefined Value' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(undefined);
      expect(args.onChange).toHaveBeenLastCalledWith([undefined]);
      await expect(selectButton).toHaveTextContent('Undefined Value');
    });

    await step('Click Reset - should clear, not select undefined option', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Reset selection' }));
      expect(args.onReset).toHaveBeenCalledTimes(1);
      expect(args.onChange).toHaveBeenLastCalledWith([]);
      await expect(selectButton).toHaveTextContent('Select fruit');
      await expect(selectButton).not.toHaveTextContent('Undefined Value');
    });

    await step('Can still select undefined value after reset', async () => {
      await userEvent.click(selectButton);
      await userEvent.click(await screen.findByRole('option', { name: 'Undefined Value' }));
      expect(args.onSelect).toHaveBeenLastCalledWith(undefined);
      expect(args.onChange).toHaveBeenLastCalledWith([undefined]);
      await expect(selectButton).toHaveTextContent('Undefined Value');
    });
  },
});

export const ShowSelectedOptionTitleTrue = meta.story({
  name: 'Show Selected Option Title (prop=true)',
  args: {
    showSelectedOptionTitle: true,
    defaultOptions: 'frog',
  },
  play: async ({ canvas, step }) => {
    await step('Verify selected option title is shown', async () => {
      const selectButton = await canvas.findByRole('button');
      expect(selectButton).toHaveTextContent('Frog');
    });
  },
});

export const ShowSelectedOptionTitleFalse = meta.story({
  name: 'Show Selected Option Title (prop=false)',
  args: {
    showSelectedOptionTitle: false,
    defaultOptions: 'frog',
  },
  play: async ({ canvas, step }) => {
    await step('Verify default title is shown instead of selected option', async () => {
      const selectButton = await canvas.findByRole('button');
      expect(selectButton).toHaveTextContent('Animal');
    });
  },
});

export const ShowSelectedOptionTitleFalseMulti = meta.story({
  name: 'Show Selected Option Title (prop=false, multi)',
  args: {
    showSelectedOptionTitle: false,
    multiSelect: true,
    defaultOptions: ['frog', 'tadpole'],
  },
  play: async ({ canvas, step }) => {
    await step('Verify default title is shown for multi-select', async () => {
      const selectButton = await canvas.findByRole('button');
      expect(selectButton).toHaveTextContent('Animal');
    });
  },
});

export const ShowSelectedOptionTitleTrueMulti = meta.story({
  name: 'Show Selected Option Title (prop=true, multi)',
  args: {
    showSelectedOptionTitle: true,
    multiSelect: true,
    defaultOptions: ['frog'],
  },
  play: async ({ canvas, step }) => {
    await step('Verify option count is shown for multi-select', async () => {
      const selectButton = await canvas.findByRole('button');
      expect(selectButton).toHaveTextContent('1');
    });
  },
});
