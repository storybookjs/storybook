import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Addon-docs docgen provider.
 *
 * This is a phase-1 placeholder whose only job is to prove that multiple providers can stack and
 * merge — it appends a marker to the description and adds a synthetic prop entry on every
 * component. Calls `nextDocgen?.(input)` so it works whether or not core's identity seed is
 * present at the bottom of the chain.
 */
export const experimental_docgenProvider: PresetPropertyFn<'experimental_docgenProvider'> = async (
  nextDocgen
) => {
  const wrapped: DocgenProvider = async (input) => {
    const downstream = await nextDocgen?.(input);
    return {
      componentId: input.componentId,
      name: downstream?.name ?? '',
      description: downstream?.description
        ? `${downstream.description} (docs enabled)`
        : 'docs enabled',
      props: [
        ...(downstream?.props ?? []),
        { source: '@storybook/addon-docs', kind: 'docs-marker' },
      ],
    };
  };

  return wrapped;
};
