import { getRefsFromConfig } from '@storybook/core/internal/story-index';
import type { Source } from '@storybook/core/internal/toolsets-docs';
import type { Options } from '@storybook/core/internal/types';
import { CompositionAuth, type ComposedRef } from './composition-auth.ts';

export type ResolvedCompositionSources = {
  refs: ComposedRef[];
  compositionAuth: CompositionAuth;
  sources: Source[] | undefined;
  multiSource: boolean;
};

export async function resolveCompositionSources(
  options: Options
): Promise<ResolvedCompositionSources> {
  const refs = await getRefsFromConfig(options);
  const compositionAuth = new CompositionAuth();

  if (refs.length === 0) {
    return { refs, compositionAuth, sources: undefined, multiSource: false };
  }

  await compositionAuth.initialize(refs);
  const sources = compositionAuth.buildSources();

  return {
    refs,
    compositionAuth,
    sources,
    multiSource: sources.some((source) => !!source.url),
  };
}
