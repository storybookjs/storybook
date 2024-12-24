import { SourceType, enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, DecoratorFunction, InputType } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './docs/custom-elements';
import { sourceDecorator } from './docs/sourceDecorator';
import type { WebComponentsRenderer } from './types';

export const decorators: DecoratorFunction<WebComponentsRenderer>[] = [sourceDecorator];

export const parameters: {
  docs: {
    extractArgTypes: (tagName: string) =>
      | {
          [x: string]: InputType;
        }
      | null
      | undefined;
    extractComponentDescription: (tagName: string) => string | null | undefined;
    story: {
      inline: true;
    };
    source: {
      type: SourceType;
      language: string;
    };
  };
} = {
  docs: {
    extractArgTypes,
    extractComponentDescription,
    story: { inline: true },
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
    },
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<WebComponentsRenderer>[] = [enhanceArgTypes];
