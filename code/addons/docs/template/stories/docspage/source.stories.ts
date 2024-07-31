import { global as globalThis } from '@storybook/global';
import type { StoryContext } from 'storybook/internal/types';
import { dedent } from 'ts-dedent';

export default {
  component: globalThis.Components.Button,
  tags: ['autodocs'],
  args: { label: 'Click Me!' },
  parameters: { chromatic: { disable: true } },
};

export const Auto = {};

export const Disabled = {
  parameters: {
    docs: {
      source: { code: null },
    },
  },
};

export const Code = {
  parameters: {
    docs: {
      source: { type: 'code' },
    },
  },
};

export const Custom = {
  parameters: {
    docs: {
      source: { code: 'custom source' },
    },
  },
};

export const Transform = {
  parameters: {
    docs: {
      source: {
        transform(src: string, storyContext: StoryContext) {
          return dedent`// We transformed this!
          // The current args are: ${JSON.stringify(storyContext.args)}
          const example = (${src});
          `;
        },
      },
    },
  },
};
