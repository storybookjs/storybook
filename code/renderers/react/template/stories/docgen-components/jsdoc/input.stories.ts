import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as JsDocProps } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/jsdoc',
  component: JsDocProps,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof JsDocProps>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
