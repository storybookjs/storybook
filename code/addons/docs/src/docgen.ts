import { defineDocgenProvider } from 'storybook/internal/common';

/**
 * Addon-docs docgen provider.
 *
 * A small enrichment layer: appends a `(docs enabled)` marker to the downstream description so
 * consumers can tell that addon-docs participated. Does NOT produce docgen on its own — when no
 * downstream provider supplied a payload it returns undefined so the chain falls through.
 */
export const experimental_docgenProvider = defineDocgenProvider((next) => async (input) => {
  const downstream = await next(input);
  if (!downstream) {
    return undefined;
  }
  return {
    ...downstream,
    description: downstream.description
      ? `${downstream.description} (docs enabled)`
      : 'docs enabled',
  };
});
