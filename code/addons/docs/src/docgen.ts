import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Addon-docs docgen provider.
 *
 * This is a phase-1 placeholder whose only job is to prove that multiple providers can stack and
 * merge — it appends a marker to the downstream description and adds a synthetic prop entry. It
 * does NOT produce docgen on its own; if no downstream provider supplied a payload, it returns
 * undefined so the chain falls through.
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
      props: [...downstream.props, { source: '@storybook/addon-docs', kind: 'docs-marker' }],
    };
  };

  return wrapped;
};
