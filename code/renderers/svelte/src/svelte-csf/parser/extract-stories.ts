import { compile, type Root } from 'svelte/compiler';

import type { StoriesFileMeta } from './types.js';
import { walkOnModule } from './walkers/module.js';
import { walkOnInstance } from './walkers/instance.js';
import { walkOnFragment } from './walkers/fragment.js';

/**
 * Parse a Svelte component and extract stories.
 * @param rawSource Component Source
 * @returns Map of storyName -> source
 */
export function extractStories(rawSource: string): StoriesFileMeta {
  // compile
  const { ast }: { ast: Root } = compile(rawSource, {
    // TODO: Will need migrate to modernAst
    // modernAst: true,
  });
  // FIXME: Upstream typing issue from `svelte/compiler`
  const { module, instance, html } = ast;

  const moduleMeta = walkOnModule(module);
  const { addonComponents } = walkOnInstance(instance);
  const fragmentMeta = walkOnFragment({
    fragment: html,
    rawSource,
    addonComponents,
  });

  return {
    module: moduleMeta,
    fragment: fragmentMeta,
  };
}
