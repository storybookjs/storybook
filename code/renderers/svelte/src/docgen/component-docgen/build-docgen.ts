import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

// TODO: port the svelte-vite svelte2tsx engine; `undefined` defers to the rest of the chain.
export function buildDocgenPayload(_input: DocgenProviderInput): DocgenPayload | undefined {
  return undefined;
}
