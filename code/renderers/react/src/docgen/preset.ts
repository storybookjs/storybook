import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Phase-1 mock docgen provider for the React renderer.
 *
 * Wraps the previously accumulated provider (received as the preset `config`) and returns a new
 * provider that synthesizes a deterministic name + description from the componentId. Calls
 * `nextDocgen?.(input)` optionally — core's `services` preset normally seeds the chain with an
 * identity provider, but the optional chain keeps this file independent of that detail.
 *
 * Phase 3 will replace this body with a real RCM-backed provider.
 */
export const experimental_docgenProvider: PresetPropertyFn<'experimental_docgenProvider'> = async (
  nextDocgen
) => {
  const wrapped: DocgenProvider = async (input) => {
    const downstream = await nextDocgen?.(input);
    const fallbackName = input.entries[0]?.title.split('/').at(-1) ?? input.componentId;
    return {
      componentId: input.componentId,
      name: downstream?.name || fallbackName,
      description: downstream?.description || `Mocked docgen for ${input.componentId}`,
      props: downstream?.props ?? [],
    };
  };

  return wrapped;
};
