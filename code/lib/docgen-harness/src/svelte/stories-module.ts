import { isStory } from 'storybook/internal/csf';
import type { Story } from 'storybook/internal/csf';
import type {
  Args,
  ComponentAnnotations,
  NormalizedProjectAnnotations,
  Renderer,
  StoryAnnotationsOrFn,
} from 'storybook/internal/types';

import { composeStory } from 'storybook/internal/preview-api';

import { setProjectAnnotations } from '../../../../renderers/svelte/src/portable-stories.ts';
import type { SvelteRenderer } from '../../../../renderers/svelte/src/types.ts';

// The Svelte defaults composed with the core annotations: what a CSF3 story gets in Storybook.
const CSF3_PROJECT_ANNOTATIONS = setProjectAnnotations([]);

export type StoriesModule<TMeta, TStory> = {
  meta: TMeta;
  stories: Record<string, TStory>;
  // The composed annotations of a CSF4 module's preview. CSF3 modules have none.
  projectAnnotations?: NormalizedProjectAnnotations<Renderer>;
};

// A CSF4 module has no default export: each story factory holds its meta. `extend()` merges the
// parent into the child's `input`, so `input` alone composes any CSF4 story.
export function readStoriesModule<TMeta, TStory>(
  storiesModule: Record<string, unknown>
): StoriesModule<TMeta, TStory> {
  const factories = Object.entries(storiesModule).filter(
    (entry): entry is [string, Story<Renderer>] => isStory(entry[1])
  );
  if (factories.length > 0) {
    const meta = factories[0][1].meta;
    return {
      meta: meta.input as TMeta,
      stories: Object.fromEntries(
        factories.map(([exportName, story]) => [exportName, story.input as TStory])
      ),
      projectAnnotations: meta.preview.composed,
    };
  }

  const { default: meta, ...exports } = storiesModule;
  return {
    meta: meta as TMeta,
    stories: Object.fromEntries(
      Object.entries(exports).filter(([, value]) => isCsf3StoryExport(value))
    ) as Record<string, TStory>,
  };
}

// Loading a CSF4 preview sets the global project annotations. Pass each module's own
// annotations, as CSF4 `meta.story()` does, so the global never decides a recording.
export function composeModuleStory(
  storiesModule: StoriesModule<unknown, unknown>,
  story: unknown,
  exportName: string
) {
  return composeStory<SvelteRenderer>(
    story as StoryAnnotationsOrFn<SvelteRenderer, Args>,
    storiesModule.meta as ComponentAnnotations<SvelteRenderer>,
    undefined,
    storiesModule.projectAnnotations ?? CSF3_PROJECT_ANNOTATIONS,
    exportName
  );
}

function isCsf3StoryExport(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    ('args' in value || 'parameters' in value || 'render' in value || 'tags' in value)
  );
}
