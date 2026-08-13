import { existsSync, realpathSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { basename, dirname, extname, join, normalize, resolve } from 'pathe';

import type { ModuleGraphServiceState } from '../../services/module-graph/definition.ts';

/** Lifecycle status reported by the `core/module-graph` service. */
export type ModuleGraphStatus = ModuleGraphServiceState['status'];

/** One reverse-index hit: a story file (story-index-relative path) and its BFS import depth. */
export type ModuleGraphStoryHit = {
  /** Story-index-style relative path such as `./src/Button.stories.tsx`. */
  storyFile: string;
  /** Breadth-first-search depth: shortest number of import edges to the story file. */
  depth: number;
};

/**
 * The slice of the `core/module-graph` service this resolver needs. Structural so the caller can
 * inject the real service (or a stub) without this module doing service lookup itself.
 */
export type ModuleGraphAccess = {
  queries: {
    status: { loaded: (input?: undefined) => Promise<ModuleGraphStatus> };
    /** Positional: result `i` corresponds to input `files[i]`. */
    storiesForFiles: {
      loaded: (input: { files: string[] }) => Promise<Array<ModuleGraphStoryHit[] | undefined>>;
    };
  };
};

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;
const INDEX_BASENAMES = SOURCE_EXTENSIONS.map((ext) => `index${ext}`);

/** Storybook import paths always use forward slashes, even on Windows. */
function slash(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Expands `Foo/Foo.tsx` ↔ `Foo/index.tsx` so a query against either form hits stories that
 * imported the other. Only expands when filename or dirname clearly names the directory's
 * main export.
 */
function expandBarrelTargets(absoluteComponentPath: string): string[] {
  const targets = new Set<string>([absoluteComponentPath]);
  const dir = dirname(absoluteComponentPath);
  const ext = extname(absoluteComponentPath);
  const base = basename(absoluteComponentPath, ext);
  const dirName = basename(dir);

  if (base.toLowerCase() === 'index') {
    for (const candidateExt of SOURCE_EXTENSIONS) {
      const candidate = join(dir, `${dirName}${candidateExt}`);
      if (existsSync(candidate)) {
        targets.add(candidate);
      }
    }
  } else if (base.toLowerCase() === dirName.toLowerCase()) {
    for (const indexBasename of INDEX_BASENAMES) {
      const candidate = join(dir, indexBasename);
      if (existsSync(candidate)) {
        targets.add(candidate);
      }
    }
  }

  // The module graph accepts absolute paths but normalizes them with forward slashes; `pathe`'s
  // `normalize` emits forward slashes on Windows too, including for `realpath` output.
  return [...targets].map((target) => normalize(target));
}

/**
 * Canonicalises a path via `realpath`. Fixes silent misses on case-insensitive filesystems
 * (macOS APFS) where `BUTTON/Button.tsx` and `Button/Button.tsx` resolve to the same file but
 * only the canonical form is in the reverse-index keyset.
 *
 * Returns `undefined` if the path doesn't exist on disk — the caller surfaces that as a
 * distinct "path not found" outcome rather than a generic "no stories".
 */
function canonicalise(absolutePath: string): string | undefined {
  try {
    return realpathSync.native(absolutePath);
  } catch (err) {
    // Only a missing path is "not found"; permission/IO errors are real failures and must not be
    // silently misreported as `pathNotFound`, so rethrow anything that isn't ENOENT.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw err;
  }
}

/**
 * Normalizes a story-index `importPath` to the `./`-prefixed, forward-slash form the module graph
 * returns for its story files (e.g. `./src/Button.stories.tsx`). The module graph keys story files
 * this way, so we match on it instead of the absolute path.
 */
function toStoryFileKey(importPath: string): string {
  const normalized = slash(importPath);
  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    return normalized;
  }
  return `./${normalized}`;
}

/**
 * Map story-index-relative story-file path → story IDs declared in that file. Skips virtual entries.
 * Keys match the `storyFile` values returned by the module graph's `storiesForFiles`.
 */
function buildStoryIdsByFile(storyIndex: StoryIndex): Map<string, Set<string>> {
  const storyIdsByFile = new Map<string, Set<string>>();
  for (const entry of Object.values(storyIndex.entries)) {
    if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) {
      continue;
    }
    const filePath = toStoryFileKey(entry.importPath);
    let ids = storyIdsByFile.get(filePath);
    if (!ids) {
      ids = new Set<string>();
      storyIdsByFile.set(filePath, ids);
    }
    ids.add(entry.id);
  }
  return storyIdsByFile;
}

/** Builds the unavailable reason for a non-`ready` module-graph status. */
export function reasonForStatus(status: ModuleGraphStatus): string {
  switch (status.value) {
    case 'booting':
      return "Storybook's story module graph hasn't built yet — it is still being constructed. Retry shortly.";
    case 'unavailable':
      // The service's own reason names the adapter-specific cause; the remedy sentence stays
      // appended because the agent's next move is to check how the dev server runs, which that
      // reason does not say.
      return `Storybook's story dependency graph is unavailable: ${status.reason}. Make sure the dev server is running with a builder that supports change detection.`;
    case 'error':
      return `Storybook's story module graph failed to build: ${status.error.message}`;
    case 'ready':
      return "Storybook's story module graph is ready.";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export interface ComponentStoriesRequest {
  componentPaths: string[];
}

export interface ComponentStoryDepth {
  storyId: string;
  depth: number;
}

export interface ComponentStoriesResult {
  /** Echoes the caller's input path, lightly normalized (redundant separators etc. collapsed). */
  componentPath: string;
  matches: ComponentStoryDepth[];
  /** `true` when no file exists at the resolved absolute path — distinguishes "typo" from "no stories yet". */
  pathNotFound?: boolean;
}

export interface ComponentStoriesResponse {
  available: boolean;
  reason?: string;
  results?: ComponentStoriesResult[];
}

export interface ResolveComponentStoriesDeps {
  /** Live story index; injectable so tests can pin a fixed value. */
  getStoryIndex: () => Promise<StoryIndex>;
  /**
   * The `core/module-graph` service, or `undefined` when it isn't registered in this process (e.g.
   * a builder without change detection, or an older Storybook without the open-service API).
   */
  moduleGraph: ModuleGraphAccess | undefined;
  /** Defaults to `process.cwd()`, matching the dev server. */
  workingDir?: string;
}

/** Per-component target set, resolved before the batched module-graph lookup. */
interface ResolvedComponent {
  /** Cleaned-up echo of the caller's input path. */
  componentPath: string;
  /** Forward-slashed absolute target paths (barrel-expanded) to look up. */
  targets: string[];
  pathNotFound?: boolean;
}

/**
 * Looks up stories that consume each component path via Storybook's `core/module-graph` reverse
 * index. Returns `{ available: false }` when the graph isn't ready; otherwise per-path results.
 *
 * The unavailable/booting/error cases are reported rather than flattened into "no matches" so a
 * caller can't mistake an unsupported builder or a still-booting graph for "this component is
 * unused".
 */
export async function resolveComponentStories(
  request: ComponentStoriesRequest,
  deps: ResolveComponentStoriesDeps
): Promise<ComponentStoriesResponse> {
  const { moduleGraph } = deps;
  if (!moduleGraph) {
    return {
      available: false,
      reason:
        "Storybook's story module graph is unavailable. This Storybook version may not ship the open-service API, the module-graph service isn't registered (e.g. a builder without change detection), or the dev server is not running.",
    };
  }

  // `status.loaded` awaits the graph's settle barrier, so by the time it resolves the status is
  // no longer `booting` unless the graph genuinely never built — handle every non-ready case.
  const status = await moduleGraph.queries.status.loaded(undefined);
  if (status.value !== 'ready') {
    return { available: false, reason: reasonForStatus(status) };
  }

  const workingDir = deps.workingDir ?? process.cwd();
  const storyIndex = await deps.getStoryIndex();
  const storyIdsByFile = buildStoryIdsByFile(storyIndex);

  // Dedupe inputs so an agent that grep'd loosely doesn't get the same component echoed back twice.
  const deduped = [...new Set(request.componentPaths)];

  // Phase 1: resolve each component to its expanded set of target paths.
  const resolved: ResolvedComponent[] = deduped.map((componentPath) => {
    // Normalize first: a trailing slash on `/abs/Badge/Badge.tsx/` would otherwise flip the
    // barrel-expansion heuristic and silently return barrel consumers instead of the file.
    const absolute = resolve(workingDir, componentPath);
    const canonical = canonicalise(absolute);

    // Echo a cleaned-up form of the input (no redundant separators / `..` segments) rather than the
    // raw string. Keeps relative paths relative and absolute paths absolute.
    const echo = normalize(componentPath);

    if (!canonical) {
      return { componentPath: echo, targets: [], pathNotFound: true };
    }

    // Include both the input's normalized form and the canonical form. On case-insensitive
    // filesystems they differ when the caller passed a wrong-case path; using both means we hit
    // the graph regardless of which form the caller supplied.
    const targets = new Set<string>(expandBarrelTargets(absolute));
    if (canonical !== absolute) {
      for (const target of expandBarrelTargets(canonical)) {
        targets.add(target);
      }
    }

    return { componentPath: echo, targets: [...targets] };
  });

  // Phase 2: one batched reverse-index lookup over the union of every component's targets.
  const allTargets = [...new Set(resolved.flatMap((component) => component.targets))];
  const hitsByTarget = new Map<string, ModuleGraphStoryHit[]>();
  if (allTargets.length > 0) {
    const batched = await moduleGraph.queries.storiesForFiles.loaded({ files: allTargets });
    // Output is positional: result `i` corresponds to input `allTargets[i]`.
    allTargets.forEach((target, i) => {
      hitsByTarget.set(target, batched[i] ?? []);
    });
  }

  // Phase 3: merge hits back per component, keeping the minimum depth per storyId.
  const results: ComponentStoriesResult[] = resolved.map((component) => {
    if (component.pathNotFound) {
      return { componentPath: component.componentPath, matches: [], pathNotFound: true };
    }

    const byStoryId = new Map<string, number>();
    for (const target of component.targets) {
      const hits = hitsByTarget.get(target) ?? [];
      for (const { storyFile, depth } of hits) {
        const storyIds = storyIdsByFile.get(storyFile);
        if (!storyIds) {
          continue;
        }
        for (const storyId of storyIds) {
          const existing = byStoryId.get(storyId);
          if (existing === undefined || depth < existing) {
            byStoryId.set(storyId, depth);
          }
        }
      }
    }

    const matches: ComponentStoryDepth[] = [...byStoryId.entries()]
      .map(([storyId, depth]) => ({ storyId, depth }))
      .sort((a, b) => {
        if (a.depth !== b.depth) {
          return a.depth - b.depth;
        }
        return a.storyId.localeCompare(b.storyId);
      });

    return { componentPath: component.componentPath, matches };
  });

  return { available: true, results };
}
