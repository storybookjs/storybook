import { global as globalThis } from '@storybook/global';
import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

export default {
  component: globalThis.Components.Pre,
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: { ...context.args } } }),
  ],
  argTypes: {
    boolean: { control: 'boolean' },
    color: { control: 'color' },
    colorWithPresets: {
      control: {
        type: 'color',
        presetColors: ['#ff0', 'pink', { color: '#00f', title: 'mystery' }],
      },
    },
    colorStartOpen: { control: { type: 'color', startOpen: false } },
    date: { control: 'date' },
    file: { control: { type: 'file', accept: '.png' }, name: 'Image Urls' },
    number: { control: 'number' },
    object: { control: 'object' },
    radio: { control: { type: 'radio', options: ['a', 'b', 'c'] } },
    radioWithLabels: {
      control: { type: 'radio', options: ['a', 'b', 'c'], labels: ['alpha', 'beta', 'gamma'] },
    },
    inlineRadio: { control: { type: 'inline-radio', options: ['a', 'b', 'c'] } },
    select: { control: 'select', options: ['a', 'b', 'c', 'double  space'] },
    multiSelect: { control: { type: 'multi-select' }, options: ['a', 'b', 'c', 'double  space'] },
    range: { control: 'range' },
    rangeCustom: { control: { type: 'range', min: 0, max: 1000, step: 100 } },
    text: { control: 'text' },
  },
};

export const Undefined = {
  args: {},
};

const DEFAULT_NESTED_OBJECT = {
  text: 'Hello world',
  boolean: true,
  array: ['One', 'Two', 'Three'],
  object: { a: 1, b: 2, c: 3 },
};
export const Defined = {
  args: {
    boolean: true,
    color: '#ff0',
    colorWithPresets: 'pink',
    colorStartOpen: 'orange',
    date: new Date(2010, 1, 1),
    file: ['https://storybook.js.org/images/placeholders/350x150.png'],
    number: 10,
    object: DEFAULT_NESTED_OBJECT,
    radio: 'a',
    radioWithLabels: 'b',
    inlineRadio: 'c',
    select: 'b',
    multiSelect: ['a'],
    range: 15,
    rangeCustom: 10,
    text: 'hello',
  },
};

// export const ImageFileControl = (args) => <img src={args.imageUrls[0]} alt="Your Example Story" />;
// ImageFileControl.args = {
//   imageUrls: ['https://storybook.js.org/images/placeholders/350x150.png'],
// };

// const hasCycle: any = {};
// hasCycle.cycle = hasCycle;

// export const CyclicArgs = {
//   args: process.env.NODE_ENV !== 'test' ? { object: hasCycle } : {},
//   parameters: {
//     docs: { disable: true },
//     chromatic: { disable: true },
//   },
// };
