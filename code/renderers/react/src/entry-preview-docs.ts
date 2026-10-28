import type { DecoratorFunction } from 'storybook/internal/types';

import { getFeatures } from 'storybook/preview-api';

import { jsxDecorator } from './docs/jsxDecorator.tsx';
import { applyDecorators } from './docs/applyDecorators.ts';
import type { ReactRenderer } from './types.ts';

const useStaticServiceSnippets = getFeatures().docgenServer;
const useCompileTimeSnippets = getFeatures().experimentalCodeExamples;

export const decorators: DecoratorFunction<ReactRenderer>[] =
  useStaticServiceSnippets || useCompileTimeSnippets ? [] : [jsxDecorator];

export { applyDecorators };

export const parameters = {
  docs: {
    story: { inline: true },
  },
};

export default { decorators, applyDecorators, parameters };
