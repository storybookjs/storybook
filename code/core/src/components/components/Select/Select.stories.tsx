import React from 'react';

import { styled } from 'storybook/internal/theming';

import { FaceHappyIcon } from '@storybook/icons';

import { use } from 'chai';
import type { StoryAnnotations } from 'core/src/types';
import { expect, fn, screen, userEvent, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { Button } from '../Button/Button';
import { Select } from './Select';

const meta = preview.meta({
  id: 'select-component',
  title: 'Select',
  component: Select,
  args: {
    children: 'Animal',
    onChange: fn(),
    onSelect: fn(),
    onDeselect: fn(),
    options: [
      { label: 'Tadpole', value: 'tadpole' },
      { label: 'Pollywog', value: 'pollywog' },
      { label: 'Frog', value: 'frog' },
    ],
  },
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const Base = meta.story({});

export const Variants = meta.story({
  render: (args) => (
    <Stack>
      <Row>
        <Select variant="solid" {...args}>
          Solid
        </Select>
        <Select variant="outline" {...args}>
          Outline
        </Select>
        <Select variant="ghost" {...args}>
          Ghost
        </Select>
      </Row>
      <Row>
        <Select variant="solid" {...args}>
          <FaceHappyIcon /> Solid
        </Select>
        <Select variant="outline" {...args}>
          <FaceHappyIcon /> Outline
        </Select>
        <Select variant="ghost" {...args}>
          <FaceHappyIcon /> Ghost
        </Select>
      </Row>
      <Row>
        <Select variant="solid" padding="small" {...args}>
          <FaceHappyIcon />
        </Select>
        <Select variant="outline" padding="small" {...args}>
          <FaceHappyIcon />
        </Select>
        <Select variant="ghost" padding="small" {...args}>
          <FaceHappyIcon />
        </Select>
      </Row>
    </Stack>
  ),
});

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
  render: (args) => (
    <Stack>
      <Row>
        <Select variant="solid" {...args}>
          Select
        </Select>
        <Select variant="outline" {...args}>
          Select
        </Select>
        <Select variant="ghost" {...args}>
          Select
        </Select>
      </Row>
      <Row id="hover">
        <Select variant="solid" {...args}>
          Hover
        </Select>
        <Select variant="outline" {...args}>
          Hover
        </Select>
        <Select variant="ghost" {...args}>
          Hover
        </Select>
      </Row>
      <Row id="focus">
        <Select variant="solid" {...args}>
          Focus
        </Select>
        <Select variant="outline" {...args}>
          Focus
        </Select>
        <Select variant="ghost" {...args}>
          Focus
        </Select>
      </Row>
    </Stack>
  ),
  parameters: {
    pseudo: {
      hover: '#hover button',
      focus: '#focus button',
      active: '#active button',
    },
  },
});

export const ManyOptions = meta.story({
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
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
        label: 'This is a very long option label that might cause wrapping issues',
        value: 'long1',
      },
      {
        label:
          'Another extremely long option label that tests how the component handles overflow, and if you think that is too long, you may well be justified in thinking so, albeit it is a test case',
        value: 'long2',
      },
      { label: 'Short', value: 'short' },
    ],
  },
});

export const CustomOptionRendering = meta.story({
  name: 'Custom Option Rendering',
  args: {
    children: 'Custom options',
    options: [
      {
        label: 'Tadpole',
        value: 'tadpole',
        children: (
          <>
            <strong>1. </strong> 👶 Tadpole
          </>
        ),
      },
      {
        label: 'Pollywog',
        value: 'pollywog',
        children: (
          <>
            <strong>2. </strong> 👧 Pollywog
          </>
        ),
      },
      {
        label: 'Frog',
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
      <Button>Before</Button>
      <Select {...args} />
      <Button>After</Button>
    </Row>
  ),
});

export const DefaultOption = meta.story({
  name: 'Default Option (single)',
  args: {
    defaultOption: 'frog',
  },
});

export const DefaultOptionMulti = meta.story({
  name: 'Default Option (multi)',
  args: {
    multiSelect: true,
    defaultOption: ['tadpole', 'frog'],
  },
});

const disabledPlayFn: StoryAnnotations['play'] = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const selectButton = canvas.getByRole('combobox');
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
    defaultOption: 'frog',
  },
  play: disabledPlayFn,
});

export const DisabledWithSelectionMulti = meta.story({
  name: 'Disabled with selection (multi)',
  args: {
    disabled: true,
    multiSelect: true,
    defaultOption: ['tadpole', 'frog'],
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
  play: async ({ canvasElement, args }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    await userEvent.click(selectButton);

    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const pollywogOption = screen.getByRole('option', { name: 'Pollywog' });
    await userEvent.click(pollywogOption);

    expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Pollywog', value: 'pollywog' })
    );
    expect(args.onChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Pollywog', value: 'pollywog' }),
    ]);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(selectButton).toHaveTextContent('Pollywog');
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
      <Button>Other content</Button>
    </Row>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole('combobox');
    await userEvent.click(selectButton);

    const tadpoleOption = screen.getByRole('option', { name: 'Tadpole' });
    await userEvent.click(tadpoleOption);

    expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
    );
    expect(args.onChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
    ]);
    expect(selectButton).toHaveTextContent('1');
    expect(screen.getByRole('listbox')).toBeInTheDocument(); // Listbox should not close in multi select mode.

    const pollywogOption = screen.getByRole('option', { name: 'Pollywog' });
    await userEvent.click(pollywogOption);

    expect(args.onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
      expect.objectContaining({ label: 'Pollywog', value: 'pollywog' }),
    ]);
    expect(selectButton).toHaveTextContent('2');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.click(canvas.getByText('Other content'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); // Now closed.
  },
});

const kbSelectionTest =
  (triggerKey: string, selectKey: string): StoryAnnotations['play'] =>
  async ({ canvasElement, args, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    selectButton.focus();

    await step('Open listbox', async () => {
      await userEvent.keyboard(triggerKey);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const optionOne = screen.getByRole('option', { name: 'Tadpole' });
      expect(document.activeElement).toBe(optionOne);
    });

    await step('Press ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      const optionTwo = screen.getByRole('option', { name: 'Pollywog' });
      expect(document.activeElement).toBe(optionTwo);
    });

    await step('Select active option (closes the Select)', async () => {
      await userEvent.keyboard(selectKey);
      expect(args.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Pollywog', value: 'pollywog' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Pollywog', value: 'pollywog' }),
      ]);

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
  async ({ canvasElement, args, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    selectButton.focus();

    await step('Open listbox', async () => {
      await userEvent.keyboard(triggerKey);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const optionOne = screen.getByRole('option', { name: 'Tadpole' });
      expect(document.activeElement).toBe(optionOne);
    });

    await step('Select option one', async () => {
      await userEvent.keyboard(selectKey);
      expect(args.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
      ]);
      expect(screen.queryByRole('listbox')).toBeInTheDocument();
    });

    await step('Press ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}');
      const optionTwo = screen.getByRole('option', { name: 'Pollywog' });
      expect(document.activeElement).toBe(optionTwo);
    });

    await step('Select option two', async () => {
      await userEvent.keyboard(selectKey);
      expect(args.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Pollywog', value: 'pollywog' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
        expect.objectContaining({ label: 'Pollywog', value: 'pollywog' }),
      ]);
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

export const MouseOpenNoAutoselect = meta.story({
  name: 'AutoSelect - nothing selected on Mouse open (single)',
  play: async ({ canvasElement, args, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');

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
  play: async ({ canvasElement, args, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');

    await step('Open with Enter', async () => {
      selectButton.focus();
      await userEvent.keyboard('{Enter}');
    });

    await step('Validate the first item was selected', async () => {
      expect(args.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
      ]);
      expect(selectButton).toHaveTextContent('Tadpole');
    });

    await step('Close button with Escape', async () => {
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    await step('Validate the first item is still selected', async () => {
      expect(args.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
      ]);
      expect(selectButton).toHaveTextContent('Tadpole');
    });
  },
});

export const ArrowDownAutoSelect = meta.story({
  name: 'AutoSelect - first item select on ArrowDown (single)',
  play: async ({ canvasElement, args }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    selectButton.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
    );
    expect(args.onChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
    ]);
    expect(selectButton).toHaveTextContent('Tadpole');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  },
});

export const ArrowUpAutoSelect = meta.story({
  name: 'AutoSelect - last item select on ArrowUp (single)',
  play: async ({ canvasElement, args }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    selectButton.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Frog', value: 'frog' })
    );
    expect(args.onChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Frog', value: 'frog' }),
    ]);
    expect(selectButton).toHaveTextContent('Frog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  },
});

export const MouseFastNavPage = meta.story({
  name: 'Mouse Open - PageUp/Down',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvasElement, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');

    await step('Open select (no active option)', async () => {
      await userEvent.click(selectButton);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(document.activeElement).toBe(selectButton);
    });

    await step('Press PageDown (6th option is active)', async () => {
      await userEvent.keyboard('{PageDown}');
      const sixthOption = screen.getByRole('option', { name: 'Option 6' });
      expect(document.activeElement).toBe(sixthOption);
    });

    await step('Press PageUp (1st option is active)', async () => {
      await userEvent.keyboard('{PageUp}');
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});
export const KeyboardFastNavPage = meta.story({
  name: 'KB Open - PageUp/Down',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvasElement, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    selectButton.focus();

    await step('Open select (1st option is active)', async () => {
      await userEvent.keyboard('{Enter}');
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });

    await step('Press PageDown (6th option is active)', async () => {
      await userEvent.keyboard('{PageDown}');
      const sixthOption = screen.getByRole('option', { name: 'Option 6' });
      expect(document.activeElement).toBe(sixthOption);
    });

    await step('Press PageUp (1st option is active)', async () => {
      await userEvent.keyboard('{PageUp}');
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});

export const MouseFastNavHomeEnd = meta.story({
  name: 'Mouse Open - Home/End',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvasElement, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');

    await step('Open select (no active option)', async () => {
      await userEvent.click(selectButton);
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(document.activeElement).toBe(selectButton);
    });

    await step('Navigate to middle with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      const middleOption = screen.getByRole('option', { name: 'Option 3' });
      expect(document.activeElement).toBe(middleOption);
    });

    await step('Navigate to end with End', async () => {
      await userEvent.keyboard('{End}');
      const lastOption = screen.getByRole('option', { name: 'Option 20' });
      expect(document.activeElement).toBe(lastOption);
    });

    await step('Navigate to start with Home', async () => {
      await userEvent.keyboard('{Home}');
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});

export const KeyboardFastNavHomeEnd = meta.story({
  name: 'KB Open - Home/End',
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
  },
  play: async ({ canvasElement, step }) => {
    const selectButton = within(canvasElement).getByRole('combobox');
    selectButton.focus();

    await step('Open select (1st option is active)', async () => {
      await userEvent.keyboard('{Enter}');
      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });

    await step('Navigate to middle with ArrowDown', async () => {
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      const middleOption = screen.getByRole('option', { name: 'Option 4' });
      expect(document.activeElement).toBe(middleOption);
    });

    await step('Navigate to end with End', async () => {
      await userEvent.keyboard('{End}');
      const lastOption = screen.getByRole('option', { name: 'Option 20' });
      expect(document.activeElement).toBe(lastOption);
    });

    await step('Navigate to start with Home', async () => {
      await userEvent.keyboard('{Home}');
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(document.activeElement).toBe(firstOption);
    });
  },
});

export const MouseDeselection = meta.story({
  name: 'Mouse Deselection (multi)',
  args: {
    multiSelect: true,
    defaultOption: ['tadpole', 'pollywog'],
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole('combobox');

    await step('Check initial state', async () => {
      expect(selectButton).toHaveTextContent('2');
    });

    await step('Open select', async () => {
      await userEvent.click(selectButton);
    });

    await step('Deselect first option', async () => {
      const tadpoleOption = screen.getByRole('option', { name: 'Tadpole' });
      expect(tadpoleOption).toHaveAttribute('aria-selected', 'true');
      await userEvent.click(tadpoleOption);
      expect(args.onDeselect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Pollywog', value: 'pollywog' }),
      ]);
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
    defaultOption: ['tadpole', 'pollywog'],
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole('combobox');

    await step('Check initial state', async () => {
      expect(selectButton).toHaveTextContent('2');
    });

    await step('Open select', async () => {
      selectButton.focus();
      await userEvent.keyboard('{Enter}');
    });

    await step('Deselect first option', async () => {
      const tadpoleOption = screen.getByRole('option', { name: 'Tadpole' });
      expect(tadpoleOption).toHaveAttribute('aria-selected', 'true');
      await userEvent.keyboard('{Enter}');
      expect(args.onDeselect).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
      );
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Pollywog', value: 'pollywog' }),
      ]);
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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole('combobox');

    await userEvent.click(selectButton);

    const frogOption = screen.getByRole('option', { name: 'Frog' });
    await userEvent.click(frogOption);

    expect(args.onSelect).toHaveBeenCalledTimes(1);
    expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Frog', value: 'frog' })
    );
  },
});

export const OnDeselectHandler = meta.story({
  name: 'Handlers - onDeselect',
  args: {
    multiSelect: true,
    defaultOption: ['tadpole'],
    onDeselect: fn().mockName('onDeselect'),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole('combobox');
    await userEvent.click(selectButton);

    const tadpoleOption = screen.getByRole('option', { name: 'Tadpole' });
    await userEvent.click(tadpoleOption);

    expect(args.onDeselect).toHaveBeenCalledTimes(1);
    expect(args.onDeselect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Tadpole', value: 'tadpole' })
    );
  },
});

export const OnChangeHandler = meta.story({
  name: 'Handlers - onChange',
  args: {
    multiSelect: true,
    onChange: fn().mockName('onChange'),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole('combobox');

    await step('Open select', async () => {
      await userEvent.click(selectButton);
    });

    await step('Select first option', async () => {
      const tadpoleOption = screen.getByRole('option', { name: 'Tadpole' });
      await userEvent.click(tadpoleOption);
      expect(args.onChange).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
      ]);
    });

    await step('Select second option', async () => {
      const frogOption = screen.getByRole('option', { name: 'Frog' });
      await userEvent.click(frogOption);
      expect(args.onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ label: 'Tadpole', value: 'tadpole' }),
        expect.objectContaining({ label: 'Frog', value: 'frog' }),
      ]);
    });
  },
});
