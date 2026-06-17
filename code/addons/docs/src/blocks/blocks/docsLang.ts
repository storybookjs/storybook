import type { Parameters } from 'storybook/internal/types';

/**
 * Resolve the docs prose language (BCP-47) for a block.
 *
 * Resolved story/meta parameters are already merged (project → meta → story), so `parameters` is
 * normally sufficient; `projectParameters` is a defensive fallback for the page-level container.
 * Defaults to `'en'`.
 */
export const resolveDocsLang = (parameters?: Parameters, projectParameters?: Parameters): string =>
  parameters?.docs?.lang ?? projectParameters?.docs?.lang ?? 'en';
