import type { Meta } from '@storybook/react';

import { component as TypeScriptHtmlComponent } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-html',
  component: TypeScriptHtmlComponent,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TypeScriptHtmlComponent>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
