import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenProviderPreset } from 'storybook/internal/types';

import { getSharedComponentMetaManager } from '../componentManifest/componentMetaManagerSingleton.ts';
import type { TypescriptOptions } from '../componentManifest/getComponentImports.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

/**
 * React renderer docgen provider — phase 3: real RCM-backed extraction.
 *
 * Receives the authoritative index `entry` from the docgen service. Bails to `nextDocgen` when
 * the entry does not resolve to a CSF story file and when TypeScript isn't available. Otherwise
 * delegates to {@link buildDocgenPayload} which runs RCM against the file and returns a complete
 * {@link DocgenPayload}, or falls through to `nextDocgen` when nothing extractable is found.
 *
 * When extraction succeeds, the payload is merged with downstream via the documented
 * `{ ...downstream, ...ours }` spread idiom so any fields a future provider sets and we don't
 * know about survive intact.
 */
export const experimental_docgenProvider: DocgenProviderPreset = async (nextDocgen, options) => {
  // Resolve the typescript options preset once at chain-build time so the provider closure does
  // not re-read it on every call.
  const typescriptOptionsPromise = (options.presets?.apply<Partial<TypescriptOptions>>(
    'typescript',
    {}
  ) ?? Promise.resolve({})) as Promise<Partial<TypescriptOptions>>;

  // Pre-boot the TypeScript manager in the background, off the critical path. `import('typescript')`
  // loads a multi-MB module; deferring it to the first docgen request adds several seconds of
  // latency to that request. Kicking it off here (fire-and-forget) lets it warm up in parallel
  // with the rest of server startup, so `await getManager()` below usually resolves instantly.
  // getManager() memoizes and swallows its own errors, so this is safe to leave unawaited.
  void getSharedComponentMetaManager();

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextDocgen(input);
    }

    const componentMetaManager = await getSharedComponentMetaManager();
    if (!componentMetaManager) {
      return nextDocgen(input);
    }

    const ours = await buildDocgenPayload(input, {
      componentMetaManager,
      typescriptOptions: await typescriptOptionsPromise,
    });
    if (!ours) {
      return nextDocgen(input);
    }

    const downstream = await nextDocgen(input);
    return { ...downstream, ...ours };
  };
};
