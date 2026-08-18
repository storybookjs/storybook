import type { Meta, Story } from 'storybook/internal/csf';
import type { Renderer } from 'storybook/internal/types';

/**
 * Structural guards for CSF factory objects. They live apart from `csf-factories.ts` so runtime
 * consumers that only need to recognize factory objects (preview-api's store, docs context, Node
 * tooling) do not evaluate the factory module, whose imports pull the core annotations —
 * `storybook/test` and every addon preview — into the module graph.
 */
export function isMeta(input: unknown): input is Meta<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Meta';
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}

export function getStoryChildren<TRenderer extends Renderer>(
  story: Story<TRenderer>
): Story<TRenderer>[] {
  if ('__children' in story) {
    return story.__children as Story<TRenderer>[];
  }
  return [];
}
