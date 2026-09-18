import type { DecoratorFunction } from 'storybook/internal/types';

import { jsxDecorator } from './docs/jsxDecorator.tsx';
import type { ReactRenderer } from './types.ts';

const useStaticServiceSnippets =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalDocgenServer;
const useCompileTimeSnippets =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalCodeExamples;

export const decorators: DecoratorFunction<ReactRenderer>[] =
  useStaticServiceSnippets || useCompileTimeSnippets ? [] : [jsxDecorator];

export { applyDecorators } from './docs/applyDecorators.ts';

export const parameters = {
  docs: {
    story: { inline: true },
  },
};
