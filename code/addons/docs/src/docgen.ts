import type { DocgenProviderPreset } from 'storybook/internal/types';

/**
 * Addon-docs docgen provider.
 *
 * A small enrichment layer: appends a `(docs enabled)` marker to the downstream description so
 * consumers can tell that addon-docs participated. Does NOT produce docgen on its own — when no
 * downstream provider supplied a payload it returns undefined so the chain falls through.
 */
export const experimental_docgenProvider: DocgenProviderPreset = async (nextDocgen) => {
  return async (input) => {
    const downstream = await nextDocgen(input);
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
};
