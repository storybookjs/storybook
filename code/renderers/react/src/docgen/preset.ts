import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

// Seed used as a defensive default for `nextDocgen`. In practice core seeds the middleware chain
// with its own identity provider, so `nextDocgen` is always supplied at runtime — this default
// just satisfies the optional-typed preset slot without a non-null assertion.
const identityDocgenProvider: DocgenProvider = async (input) => ({
  componentId: input.componentId,
  name: '',
  description: '',
  props: [],
});

/**
 * Phase-1 mock docgen provider for the React renderer.
 *
 * Wraps the previously accumulated provider (received as the preset `config`) and returns a new
 * provider that synthesizes a deterministic name + description from the componentId. The wrapper
 * still calls `nextDocgen` so the middleware-merge code path is exercised end-to-end before phase
 * 3 replaces this body with a real RCM-backed provider.
 */
export const experimental_docgen: PresetPropertyFn<'experimental_docgen'> = async (
  nextDocgen = identityDocgenProvider
) => {
  const wrapped: DocgenProvider = async (input) => {
    const downstream = await nextDocgen(input);
    const fallbackName = input.entries[0]?.title.split('/').at(-1) ?? input.componentId;
    return {
      componentId: input.componentId,
      name: downstream.name || fallbackName,
      description: downstream.description || `Mocked docgen for ${input.componentId}`,
      props: downstream.props,
    };
  };

  return wrapped;
};
