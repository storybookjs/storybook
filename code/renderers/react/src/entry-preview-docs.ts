import { getSourceSnippetRuntime } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { printHole } from './docs/print-hole.ts';
import { jsxDecorator } from './docs/jsxDecorator.tsx';
import type { ReactRenderer } from './types.ts';

const snippetRuntime = getSourceSnippetRuntime();
const useCompileTimeSnippets =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalCodeExamples;

export const decorators: DecoratorFunction<ReactRenderer>[] =
  snippetRuntime === 'preview' && !useCompileTimeSnippets ? [jsxDecorator] : [];

export { applyDecorators } from './docs/applyDecorators.ts';

export const parameters = {
  docs: {
    story: { inline: true },
    ...(snippetRuntime === 'server' ? { source: { printHole } } : {}),
  },
};
