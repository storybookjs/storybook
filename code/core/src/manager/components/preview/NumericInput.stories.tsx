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
  play: async ({ canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('11');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('12');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('11');
  },
});

export const WithParsedUnit = meta.story({
  args: {
    value: '10em',
  },
  play: async ({ canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('11em');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('12em');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('11em');
  },
});

export const WithExplicitUnit = meta.story({
  args: {
    value: '10',
    unit: 'vw',
  },
  play: async ({ canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.parentElement!).toHaveTextContent('11vw');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.parentElement!).toHaveTextContent('12vw');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.parentElement!).toHaveTextContent('11vw');
  },
});

export const WithBaseUnit = meta.story({
  args: {
    value: '10em',
    baseUnit: 'em',
  },
  play: async ({ canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.parentNode!).toHaveTextContent('11em');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.parentNode!).toHaveTextContent('12em');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.parentNode!).toHaveTextContent('11em');
  },
});

export const WithMinAndMax = meta.story({
  args: {
    value: '10em',
    minValue: 9,
    maxValue: 11,
  },
  play: async ({ canvas }) => {
    const input = await canvas.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('11em');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('11em');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('11em');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('10em');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('9em');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('9em');
  },
});
