import { defineDocgenProvider } from 'storybook/internal/common';

/**
 * Phase-1 mock docgen provider for the React renderer.
 *
 * Bails to `next` for paths that don't look like CSF story files (e.g. `.mdx` attached-docs).
 * For CSF paths it synthesizes a deterministic name + description from the importPath, merged
 * with downstream via the documented spread + `??` idiom so unknown fields are preserved.
 *
 * Phase 3 will replace this body with a real RCM-backed provider.
 */
export const experimental_docgenProvider = defineDocgenProvider((next) => async (input) => {
  if (!/\.stories\.[cm]?[jt]sx?$/.test(input.importPath)) {
    return next(input);
  }

  const downstream = await next(input);
  const componentId = input.importPath.replace(/^.*\//, '').replace(/\.stories\.[cm]?[jt]sx?$/, '');
  const fallbackDescription = `Mocked docgen for ${input.importPath}`;

  return {
    ...downstream,
    componentId: downstream?.componentId ?? componentId,
    name: downstream?.name ?? componentId,
    description: downstream?.description ?? fallbackDescription,
    props: downstream?.props ?? [],
  };
});
