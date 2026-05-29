import type { DocgenProvider, PresetPropertyFn } from 'storybook/internal/types';

/**
 * Phase-1 mock docgen provider for the React renderer.
 *
 * Wraps the previously accumulated provider (received as the preset `config`) and returns a
 * new provider that synthesizes a deterministic name + description from the importPath. Bails to
 * `nextDocgen` for paths that don't look like CSF story files (e.g. `.mdx` attached-docs).
 *
 * Phase 3 will replace this body with a real RCM-backed provider.
 */
export const experimental_docgenProvider: PresetPropertyFn<'experimental_docgenProvider'> = async (
  nextDocgen
) => {
  const wrapped: DocgenProvider = async (input) => {
    if (!/\.stories\.[cm]?[jt]sx?$/.test(input.importPath)) {
      return nextDocgen?.(input);
    }

    const downstream = await nextDocgen?.(input);
    const componentId = input.importPath
      .replace(/^.*\//, '')
      .replace(/\.stories\.[cm]?[jt]sx?$/, '');
    return {
      componentId: downstream?.componentId ?? componentId,
      name: downstream?.name || componentId,
      description: downstream?.description || `Mocked docgen for ${input.importPath}`,
      props: downstream?.props ?? [],
    };
  };

  return wrapped;
};
