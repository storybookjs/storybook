import { getRefsFromConfig } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';
import { CompositionAuth, type ComposedRef } from './composition-auth.ts';

export type ResolvedCompositionSources = {
  refs: ComposedRef[];
  compositionAuth: CompositionAuth;
  multiSource: boolean;
};

export async function resolveCompositionSources(
  options: Options
): Promise<ResolvedCompositionSources> {
  const refs = await getRefsFromConfig(options);
  const compositionAuth = new CompositionAuth();

  if (refs.length > 0) {
    await compositionAuth.initialize(refs);
  }

  return {
    refs,
    compositionAuth,
    multiSource: compositionAuth.buildSources().some((source) => !!source.url),
  };
}
