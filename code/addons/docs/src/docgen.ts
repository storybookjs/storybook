import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Addon-docs docgen provider.
 *
 * A small enrichment layer over the renderer-supplied payload: appends a `(docs enabled)` marker
 * to the description so consumers can tell that addon-docs participated. Does NOT produce docgen
 * on its own — when no downstream provider supplied a payload it returns undefined so the chain
 * falls through cleanly.
 */
export const experimental_docgenProvider: PresetPropertyFn<'experimental_docgenProvider'> = async (
  nextDocgen
) => {
  const wrapped: DocgenProvider = async (input) => {
    const downstream = await nextDocgen?.(input);
    if (!downstream) {
      return undefined;
    }
    return {
      ...downstream,
      description: downstream.description
        ? `${downstream.description} (docs enabled)`
        : 'docs enabled',
    };
  };

  return wrapped;
};
