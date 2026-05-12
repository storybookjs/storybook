/**
 * Build the proposed `get_change_context` MCP-tool payload from a live
 * change-detection snapshot. Self-contained so payload size / token cost
 * can be measured independent of any agent invocation.
 */
import type { Scenario } from '../scenarios.ts';
import type { CdStatus, StoryIndex } from './storybook-client.ts';

export interface ChangeContextPayload {
  modified: string[];
  affected: string[];
  new: string[];
  cssAffected: string[];
  rawDiff: { path: string; hunks: string }[];
  projectShape: {
    totalStories: number;
    topNamespaces: { name: string; count: number }[];
  };
  reverseIndexSlice: { changedFile: string; importingStories: string[] }[];
  /** Optional (Round-2 §I.5): story-id → depth (number of import hops from the changed file). */
  depthByStory?: Record<string, number>;
  /** Optional (Round-2 §I.5): same data grouped into ascending-depth tiers. */
  depthTiers?: { depth: number; stories: string[] }[];
}

/**
 * Computed once per run, NOT sent to the agent. Used only by the HTML
 * report to render a file-level dependency graph (changed file → component
 * files → story files). Map every flagged story → its file path (story
 * file, e.g. `core/src/manager/components/sidebar/Sidebar.stories.tsx`).
 * Pulled from Storybook's index.json.
 */
export function buildStoryToFile(
  payload: ChangeContextPayload,
  index: { entries: Record<string, { importPath?: string }> }
): Record<string, string> {
  const out: Record<string, string> = {};
  const allIds = [...payload.modified, ...payload.affected, ...payload.new, ...payload.cssAffected];
  for (const id of allIds) {
    const e = index.entries[id];
    if (e?.importPath) {
      out[id] = e.importPath.replace(/^\.\/?/, '').replace(/^code\//, '');
    }
  }
  return out;
}

export function buildPayload(args: {
  statuses: CdStatus[];
  rawDiff: string;
  scenario: Scenario;
  index: StoryIndex;
  depthByStory?: Record<string, number>;
}): ChangeContextPayload {
  const modified = args.statuses
    .filter((s) => s.value === 'status-value:modified')
    .map((s) => s.storyId);
  const affected = args.statuses
    .filter((s) => s.value === 'status-value:affected')
    .map((s) => s.storyId);
  const newSet = args.statuses
    .filter((s) => s.value === 'status-value:new')
    .map((s) => s.storyId);

  // CSS blast radius would normally be synthesised server-side via a
  // reverse-index lookup over the changed CSS files. The deterministic
  // baseline is empty — change-detection is structurally CSS-blind.
  const cssAffected: string[] = [];

  const totalStories = Object.keys(args.index.entries).length;
  const namespaceCounts: Record<string, number> = {};
  for (const e of Object.values(args.index.entries)) {
    const top = (e.title || '').split('/')[0] || '?';
    namespaceCounts[top] = (namespaceCounts[top] || 0) + 1;
  }
  const topNamespaces = Object.entries(namespaceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const reverseIndexSlice = [
    {
      changedFile: args.scenario.filePath,
      importingStories: [...modified, ...affected],
    },
  ];

  const flagged = new Set([...modified, ...affected, ...newSet]);
  let depthTiers: { depth: number; stories: string[] }[] | undefined;
  let depthByStoryFiltered: Record<string, number> | undefined;
  if (args.depthByStory) {
    depthByStoryFiltered = {};
    const byDepth = new Map<number, string[]>();
    for (const [id, d] of Object.entries(args.depthByStory)) {
      if (!flagged.has(id)) continue;
      depthByStoryFiltered[id] = d;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(id);
    }
    depthTiers = [...byDepth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([depth, stories]) => ({ depth, stories }));
  }

  return {
    modified,
    affected,
    new: newSet,
    cssAffected,
    rawDiff: [{ path: args.scenario.filePath, hunks: args.rawDiff }],
    projectShape: { totalStories, topNamespaces },
    reverseIndexSlice,
    depthByStory: depthByStoryFiltered,
    depthTiers,
  };
}
