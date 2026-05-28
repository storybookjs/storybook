import type { DocgenExtractor, PresetPropertyFn } from 'storybook/internal/types';

// Seed used as a defensive default for `nextDocgen`. In practice core seeds the middleware chain
// with its own identity extractor, so `nextDocgen` is always supplied at runtime — this default
// just satisfies the optional-typed preset slot without a non-null assertion.
const passthroughDocgen: DocgenExtractor = async (input) => ({
  componentId: input.componentId,
  name: '',
  description: '',
  props: [],
});

/**
 * Phase-1 mock docgen extractor for the React renderer.
 *
 * Wraps the previously accumulated extractor (received as the preset `config`) and returns a new
 * extractor that synthesizes a deterministic name + description from the componentId. The wrapper
 * still calls `nextDocgen` so the middleware-merge code path is exercised end-to-end before phase
 * 3 replaces this body with a real RCM-backed extractor.
 */
export const experimental_docgen: PresetPropertyFn<'experimental_docgen'> = async (
  nextDocgen = passthroughDocgen
) => {
  const wrapped: DocgenExtractor = async (input) => {
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
