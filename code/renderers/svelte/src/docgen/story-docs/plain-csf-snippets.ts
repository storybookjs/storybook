import type { ArgTypes } from 'storybook/internal/types';

import { printSvelteCsfSnippet } from './svelte-csf-snippets.ts';

export function printPlainCsfSnippet({
  componentName,
  args,
  argTypes,
}: {
  componentName: string;
  args: Record<string, unknown>;
  argTypes: ArgTypes;
}): string {
  const props = Object.fromEntries(Object.entries(args).filter(([key]) => !argTypes[key]?.action));
  return printSvelteCsfSnippet({ code: `<${componentName} {...args} />`, args: props, argTypes });
}
