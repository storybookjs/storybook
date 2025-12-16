import { expect, fireEvent, fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { NumericInput } from './NumericInput';

const meta = preview.meta({
  component: NumericInput,
  tags: ['autodocs'],
  args: {
    setValue: fn(),
  },
});

export default meta;

export const Default = meta.story({
  args: {
    value: '10',
  },
  play: async ({ args, canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('11');
    expect(args.setValue).toHaveBeenNthCalledWith(1, '11');
    expect(args.setValue).toHaveBeenNthCalledWith(2, '12');
    expect(args.setValue).toHaveBeenNthCalledWith(3, '11');
  },
});

export const WithImplicitUnit = meta.story({
  args: {
    value: '10em',
  },
  play: async ({ args, canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('11em');
    expect(args.setValue).toHaveBeenNthCalledWith(1, '11em');
    expect(args.setValue).toHaveBeenNthCalledWith(2, '12em');
    expect(args.setValue).toHaveBeenNthCalledWith(3, '11em');
  },
});

export const WithExplicitUnit = meta.story({
  args: {
    value: '10',
    unit: 'vw',
  },
  play: async ({ args, canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('11vw');
    expect(args.setValue).toHaveBeenNthCalledWith(1, '11vw');
    expect(args.setValue).toHaveBeenNthCalledWith(2, '12vw');
    expect(args.setValue).toHaveBeenNthCalledWith(3, '11vw');
  },
});

export const WithBaseUnit = meta.story({
  args: {
    value: '10em',
    baseUnit: 'em',
  },
  play: async ({ args, canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('11');
    expect(args.setValue).toHaveBeenNthCalledWith(1, '11em');
    expect(args.setValue).toHaveBeenNthCalledWith(2, '12em');
    expect(args.setValue).toHaveBeenNthCalledWith(3, '11em');
  },
});
