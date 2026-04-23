import { normalize } from 'pathe';

import type { ReverseIndex } from './types.ts';

/**
 * In-memory reverse index from dep file → story file → shortest BFS depth.
 *
 * Path keys are normalised defensively via `pathe.normalize` on every mutation;
 * callers SHOULD normalise too (defence in depth).
 */
export class ReverseIndexImpl {
  private readonly index: ReverseIndex = new Map();

  /** Records (or updates with min) the depth for (dep, story). */
  record(dep: string, story: string, depth: number): void {
    const depKey = normalize(dep);
    const storyKey = normalize(story);
    let inner = this.index.get(depKey);
    if (!inner) {
      inner = new Map<string, number>();
      this.index.set(depKey, inner);
    }
    const previous = inner.get(storyKey);
    if (previous === undefined || depth < previous) {
      inner.set(storyKey, depth);
    }
  }

  /** Removes a story from every inner map; prunes outer entries that become empty. */
  removeStory(story: string): void {
    const storyKey = normalize(story);
    for (const [depKey, inner] of this.index) {
      if (inner.delete(storyKey) && inner.size === 0) {
        this.index.delete(depKey);
      }
    }
  }

  /** Removes a single (dep, story) pair without affecting other stories' depths to that dep. */
  removeEdge(dep: string, story: string): void {
    const depKey = normalize(dep);
    const storyKey = normalize(story);
    const inner = this.index.get(depKey);
    if (!inner) {
      return;
    }
    if (inner.delete(storyKey) && inner.size === 0) {
      this.index.delete(depKey);
    }
  }

  /** Returns the per-story depth map for dep. EMPTY map (not undefined) if dep unknown. */
  lookup(dep: string): Map<string, number> {
    const depKey = normalize(dep);
    return this.index.get(depKey) ?? new Map<string, number>();
  }

  /** Internal state inspection — for tests. Returns the underlying Map. */
  asMap(): ReverseIndex {
    return this.index;
  }
}
