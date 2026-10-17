import type { ArgTypes } from 'storybook/internal/types';

import { printSvelteCsfSnippet } from './svelte-csf-snippets.ts';

export function printPlainCsfSnippet({
  componentName,
  args,
  argTypes,
  expressions,
}: {
  componentName: string;
  args: Record<string, unknown>;
  argTypes: ArgTypes;
  expressions?: Record<string, string>;
}): string {
  const props = Object.fromEntries(Object.entries(args).filter(([key]) => !argTypes[key]?.action));
  return printSvelteCsfSnippet({
    code: `<${componentName} {...args} />`,
    args: props,
    argTypes,
    expressions,
  });
}
