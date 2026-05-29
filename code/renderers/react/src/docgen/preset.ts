import type { DocgenProviderPreset } from 'storybook/internal/types';

/**
 * Phase-1 mock docgen provider for the React renderer.
 *
 * Bails to `nextDocgen` for paths that don't look like CSF story files (e.g. `.mdx`
 * attached-docs). For CSF paths it synthesizes a deterministic name + description from the
 * importPath, merged with downstream via the documented spread + `??` idiom so unknown fields
 * are preserved.
 *
 * Phase 3 will replace this body with a real RCM-backed provider.
 */
export const experimental_docgenProvider: DocgenProviderPreset = async (nextDocgen) => {
  return async (input) => {
    if (!/\.stories\.[cm]?[jt]sx?$/.test(input.importPath)) {
      return nextDocgen(input);
    }

    const downstream = await nextDocgen(input);
    const componentId = input.importPath
      .replace(/^.*\//, '')
      .replace(/\.stories\.[cm]?[jt]sx?$/, '');
    const fallbackDescription = `Mocked docgen for ${input.importPath}`;

    return {
      ...downstream,
      componentId: downstream?.componentId ?? componentId,
      name: downstream?.name ?? componentId,
      description: downstream?.description ?? fallbackDescription,
      props: downstream?.props ?? [],
    };
  };
};
