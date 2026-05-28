import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Addon-docs docgen provider.
 *
 * A small layer over the renderer-supplied payload: appends a `(docs enabled)` marker to the
 * description so consumers can tell that addon-docs participated, and propagates everything else
 * downstream produced. Calls `nextDocgen?.(input)` so it composes correctly whether or not
 * core's identity seed is present at the bottom of the chain.
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
      summary: downstream?.summary,
      jsDocTags: downstream?.jsDocTags,
      props: downstream?.props ?? [],
      subcomponents: downstream?.subcomponents,
      stories: downstream?.stories,
      error: downstream?.error,
    };
  };

  return wrapped;
};
