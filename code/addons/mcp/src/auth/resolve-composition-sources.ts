import { ComponentManifestMap, type Source } from '@storybook/mcp';
import type { Options } from 'storybook/internal/types';
import * as v from 'valibot';
import { CompositionAuth, type ComposedRef } from './composition-auth.ts';
import { getRefsFromConfig } from './get-refs-from-config.ts';

const MANIFEST_PROBE_TIMEOUT_MS = 3_000;

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

export async function resolveServerlessCompositionSources(
  options: Options
): Promise<Pick<ResolvedCompositionSources, 'refs' | 'sources' | 'multiSource'>> {
  const refs = await getRefsFromConfig(options);
  const refsWithManifests = await Promise.all(
    refs.map(async (ref) =>
      (await hasServerlessComponentManifestSource(ref.url)) ? ref : undefined
    )
  );
  const sources: Source[] = [
    { id: 'local', title: 'Local' },
    ...refsWithManifests
      .filter((ref): ref is ComposedRef => !!ref)
      .map((ref) => ({
        id: ref.id,
        title: ref.title,
        url: ref.url,
      })),
  ];

  return {
    refs,
    sources,
    multiSource: sources.some((source) => !!source.url),
  };
}

async function hasServerlessComponentManifestSource(refUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANIFEST_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(
      new URL('manifests/components.json', `${refUrl.replace(/\/$/, '')}/`),
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    if (response.status === 401 && hasOAuthResourceMetadataChallenge(response)) {
      return true;
    }
    if (!response.ok) {
      return false;
    }
    const text = await response.text();
    return v.safeParse(v.pipe(v.string(), v.parseJson(), ComponentManifestMap), text).success;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function hasOAuthResourceMetadataChallenge(response: Response): boolean {
  return /resource_metadata="[^"]+"/.test(response.headers.get('WWW-Authenticate') ?? '');
}
