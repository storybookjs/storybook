import type { ReverseIndex } from './types.ts';

/**
 * In-memory reverse index from dep file → story file → shortest BFS depth.
 *
 * **Contract:** callers MUST pass already-normalised paths (`pathe.normalize`); the index
 * does not re-normalise on each mutation. Producers in `DependencyGraphBuilder` and
 * `IncrementalPatcher` already normalise at the boundary.
 */
export class ReverseIndexImpl {
  private readonly index: ReverseIndex = new Map();

  /** Records (or updates with min) the depth for (dep, story). */
  record(dep: string, story: string, depth: number): void {
    let inner = this.index.get(dep);
    if (!inner) {
      inner = new Map<string, number>();
      this.index.set(dep, inner);
    }
    const previous = inner.get(story);
    if (previous === undefined || depth < previous) {
      inner.set(story, depth);
    }
  }

  /** Removes a story from every inner map; prunes outer entries that become empty. */
  removeStory(story: string): void {
    for (const [depKey, inner] of this.index) {
      if (inner.delete(story) && inner.size === 0) {
        this.index.delete(depKey);
      }
    }
  }

  /** Removes a single (dep, story) pair without affecting other stories' depths to that dep. */
  removeEdge(dep: string, story: string): void {
    const inner = this.index.get(dep);
    if (!inner) {
      return;
    }
    if (inner.delete(story) && inner.size === 0) {
      this.index.delete(dep);
    }
  }

  /** Returns the per-story depth map for dep. EMPTY map (not undefined) if dep unknown. */
  lookup(dep: string): Map<string, number> {
    return this.index.get(dep) ?? new Map<string, number>();
  }

  /** Internal state inspection — for tests. */
  asMap(): ReverseIndex {
    return this.index;
  }
}
