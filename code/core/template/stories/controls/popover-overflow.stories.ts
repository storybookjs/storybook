import { global as globalThis } from '@storybook/global';

// Generates a long union type detail to verify the popover scrolls instead of overflowing the viewport
const LONG_UNION_TYPE = Array.from(
  { length: 40 },
  (_, i) => `  | "very-long-option-name-${String(i + 1).padStart(2, '0')}"`
).join('\n');

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  parameters: {
    controls: { expanded: true },
    chromatic: { disableSnapshot: true },
  },
  args: {
    complexType: 'very-long-option-name-01',
    object: {},
  },
  argTypes: {
    complexType: {
      control: 'text',
      table: {
        type: {
          summary: 'ComplexUnionType',
          detail: `type ComplexUnionType =\n${LONG_UNION_TYPE}`,
        },
      },
    },
  },
};

export const LongTypeDetail = {
  parameters: { chromatic: { disableSnapshot: true } },
};
