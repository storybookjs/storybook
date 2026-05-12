/**
 * Experiment O — deterministic clustering baselines.
 *
 * Two cheap, reproducible alternatives to the LLM categoriser. Both consume
 * the same `payload` the agent gets and emit the same Cluster[] shape, so
 * `score()` can grade them identically.
 *
 * 1. Namespace clustering (`byNamespace`): group stories by the part of
 *    storyId before `--`. Trivial; matches the way Storybook's sidebar
 *    organises stories.
 *
 * 2. Shared-changed-file clustering (`bySharedChangedFiles`): group stories
 *    by which subset of the changed files they import (via the
 *    `reverseIndexSlice`). Stories importing the same set go in one cluster.
 *    For single-file changesets degenerates to one cluster — which is
 *    informative on its own.
 *
 * Optional rationale text uses a deterministic template — short and
 *    machine-generated; surfaces the *facts* of the cluster, not intent.
 */
import type { ChangeContextPayload } from './build-payload.ts';
import type { Cluster } from './score.ts';

/** Cluster every input story by its namespace prefix (everything before `--`). */
export function clusterByNamespace(payload: ChangeContextPayload): Cluster[] {
  const allIds = [
    ...payload.modified,
    ...payload.affected,
    ...payload.new,
    ...payload.cssAffected,
  ];
  const byNs = new Map<string, string[]>();
  for (const id of allIds) {
    const ns = id.split('--')[0];
    if (!byNs.has(ns)) byNs.set(ns, []);
    byNs.get(ns)!.push(id);
  }
  const sorted = [...byNs.entries()].sort((a, b) => b[1].length - a[1].length);
  return sorted.map(([ns, stories]) => ({
    id: `ns:${ns}`,
    rationale: `Stories under the \`${ns}\` namespace (${stories.length}).`,
    representative: stories[0],
    stories,
  }));
}

/**
 * Cluster every input story by its imported subset of the changed files.
 *
 * The `reverseIndexSlice` field shipped to the agent maps each changed file
 * to the stories importing it. We invert: each story → set of changed files
 * it imports. Stories with identical sets share a cluster.
 *
 * NOTE: in the current eval payload, the slice has only ONE entry (the file
 * we synthetically edited), so this baseline degenerates to a single cluster
 * for synthetic scenarios. It earns its place on REAL multi-file changesets
 * (see Experiment L).
 */
export function clusterBySharedChangedFiles(payload: ChangeContextPayload): Cluster[] {
  // Build inverse map: story → sorted list of changed-file paths it imports.
  const storyToFiles = new Map<string, string[]>();
  for (const slice of payload.reverseIndexSlice ?? []) {
    for (const story of slice.importingStories) {
      if (!storyToFiles.has(story)) storyToFiles.set(story, []);
      storyToFiles.get(story)!.push(slice.changedFile);
    }
  }
  // Stories that aren't in the slice (e.g. cssAffected synthesised separately,
  // or `new` stories) get their own bucket so we don't drop them.
  const allIds = [
    ...payload.modified,
    ...payload.affected,
    ...payload.new,
    ...payload.cssAffected,
  ];
  const groups = new Map<string, string[]>();
  for (const id of allIds) {
    const files = storyToFiles.get(id);
    const key =
      files && files.length > 0
        ? files.slice().sort().join('|')
        : '__no_slice_data__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  return sorted.map(([key, stories], i) => {
    const files = key === '__no_slice_data__' ? [] : key.split('|');
    return {
      id:
        files.length === 0
          ? `shared-files:none`
          : `shared-files:${files.length}@${i}`,
      rationale:
        files.length === 0
          ? `Stories not present in the reverse-index slice (${stories.length}). Likely from cssAffected synthesis or 'new' status.`
          : files.length === 1
          ? `Stories importing only \`${files[0].split('/').pop()}\` from the changed set (${stories.length}).`
          : `Stories importing the same ${files.length} changed files (${stories.length}): ${files.map((f) => f.split('/').pop()).join(', ')}.`,
      representative: stories[0],
      stories,
    };
  });
}
