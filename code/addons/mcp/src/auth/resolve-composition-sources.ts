import { getRefsFromConfig } from '@storybook/core/internal/story-index';
import type { Source } from '@storybook/core/internal/toolsets-docs';
import type { Storybook } from '@storybook/core';
import { CompositionAuth, type ComposedRef } from './composition-auth.ts';

export type ResolvedCompositionSources = {
  refs: ComposedRef[];
  compositionAuth: CompositionAuth;
  sources: Source[] | undefined;
  multiSource: boolean;
};

export async function resolveCompositionSources(
  storybook: Pick<Storybook, 'callHook'>
): Promise<ResolvedCompositionSources> {
  const refs = await getRefsFromConfig(storybook);
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
