import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

// Defensive fallback: in practice core seeds the middleware chain with its own identity provider.
const identityDocgenProvider: DocgenProvider = async (input) => ({
  componentId: input.componentId,
  name: '',
  description: '',
  props: [],
});

/**
 * Addon-docs docgen provider.
 *
 * This is a phase-1 placeholder whose only job is to prove that multiple providers can stack and
 * merge — it appends a marker to the description and adds a synthetic prop entry on every
 * component. The renderer-side provider runs alongside it; their outputs combine through the
 * middleware chain.
 */
export const experimental_docgen: PresetPropertyFn<'experimental_docgen'> = async (
  nextDocgen = identityDocgenProvider
) => {
  const wrapped: DocgenProvider = async (input) => {
    const downstream = await nextDocgen(input);
    return {
      ...downstream,
      description: downstream.description
        ? `${downstream.description} (docs enabled)`
        : 'docs enabled',
      props: [...downstream.props, { source: '@storybook/addon-docs', kind: 'docs-marker' }],
    };
  };

  return wrapped;
};
