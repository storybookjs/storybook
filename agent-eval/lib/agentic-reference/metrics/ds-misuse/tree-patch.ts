// The unified diff between the pinned baseline tree and what a run left behind.
//
// tree-diff.ts already answers "which files changed" for the SLoC metrics, but
// the judge needs the actual hunks: it has to see what the agent wrote to decide
// whether a component was used correctly. That is a different question and a
// different output, so this lives beside rather than inside it.
//
// git diff --no-index is the engine. Two of its behaviours drive the code below:
// it exits 1 when the trees differ (success here), and it names both absolute
// tree roots in every header, which would leave the judge staring at two cache
// paths instead of the repo path it needs.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { isExcludedPath, SOURCE_EXTENSIONS } from '../../tree/paths.ts';

/** 512 KB ≈ 128k tokens, clear of the window alongside the ~95k-token doc corpus. */
const DEFAULT_MAX_BYTES = 512 * 1024;

const DIFF_TIMEOUT_SECONDS = 120;

export interface TreePatch {
  /** The unified diff, workspace-relative and filtered. */
  text: string;
  /**
   * Workspace-relative post-image paths present in `text`, in block order.
   * Feeds the treatment census include-list — what the run's tree looks like
   * now, at these paths.
   */
  files: string[];
  /**
   * Deduped workspace-relative pre-image paths of kept blocks, in block
   * order. Scopes the before-census to the files the diff actually touches,
   * so move-matching only ever sees the origin the diff itself can show.
   * Equal to `files` block-for-block except where a block is a rename, where
   * the pre- and post-image paths differ.
   */
  beforePaths: string[];
  /** Whether the byte cap dropped anything. */
  truncated: boolean;
  /** How many whole file blocks the cap dropped. */
  droppedFiles: number;
}

export interface TreePatchOptions {
  maxBytes?: number;
}

interface BlockPaths {
  before: string;
  after: string;
}

/**
 * The pre- and post-image paths a `diff --git a/<x> b/<y>` header names, or
 * null if unparseable. Equal for every block but a rename, where the agent
 * left a file under a different path than it started at.
 */
function pathsOfBlock(block: string): BlockPaths | null {
  const header = /^diff --git a\/(\S+) b\/(\S+)/.exec(block);
  if (header === null) return null;
  const before = header[1];
  const after = header[2];
  if (before === undefined || after === undefined) return null;
  return { before, after };
}

function isJudgeable(path: string): boolean {
  return SOURCE_EXTENSIONS.test(path) && !isExcludedPath(path);
}

/**
 * Erase both tree roots so every header reads as a repo-relative path.
 *
 * git writes the roots with their leading slash stripped — an absolute
 * `/cache/before` comes back as `a/cache/before/src/App.tsx` — so the leading
 * slash has to be stripped here too. Matching on the absolute spelling would
 * find `/cache/before/` one character in and swallow the slash of the `a/`
 * prefix, leaving `asrc/App.tsx`.
 */
function stripRoots(text: string, roots: string[]): string {
  return (
    roots
      .map((root) => root.replace(/^\/+/, ''))
      // Longest first, so a root that prefixes the other cannot leave a fragment.
      .sort((a, b) => b.length - a.length)
      .reduce((stripped, root) => stripped.split(`${root}/`).join(''), text)
  );
}

/**
 * Diff two checked-out trees. Both roots are rewritten out of the output so the
 * result reads as repo-relative, and the whole thing is capped — cutting at a
 * file boundary, because half a hunk reads as a real edit rather than a cut.
 */
export function treePatch(
  baselineDir: string,
  projectDir: string,
  options: TreePatchOptions = {}
): TreePatch {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  // git exits 1 for a path it cannot access exactly as it does for a difference,
  // so an absent tree is indistinguishable from a clean one below: a run whose
  // project directory never got copied out would return an empty patch and be
  // judged as having written nothing, which scores as flawless.
  for (const dir of [baselineDir, projectDir]) {
    if (!existsSync(dir)) throw new Error(`ds-misuse: tree not found: ${dir}`);
  }

  let raw = '';
  try {
    raw = execFileSync('git', ['diff', '--no-index', '--no-color', '--', baselineDir, projectDir], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: DIFF_TIMEOUT_SECONDS * 1000,
    });
  } catch (error) {
    // Exit 1 is "the trees differ", which is the normal case here.
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    if (failure.status !== 1) {
      throw new Error(`ds-misuse: git diff failed: ${failure.stderr ?? String(error)}`);
    }
    raw = failure.stdout ?? '';
  }

  const relative = stripRoots(raw, [baselineDir, projectDir]);

  const blocks = relative
    .split(/^(?=diff --git )/m)
    .map((block) => block.trim())
    .filter((block) => block.startsWith('diff --git '));

  const kept: string[] = [];
  const files: string[] = [];
  const beforePaths: string[] = [];
  const seenBeforePaths = new Set<string>();
  let bytes = 0;
  let droppedFiles = 0;

  for (const block of blocks) {
    const paths = pathsOfBlock(block);
    // Judgeability is decided on the post-image path, same as before: it is
    // what the run actually produced at that location.
    if (paths === null || !isJudgeable(paths.after)) continue;

    const size = Buffer.byteLength(block, 'utf8') + 1;
    if (bytes + size > maxBytes) {
      droppedFiles += 1;
      continue;
    }
    bytes += size;
    kept.push(block);
    files.push(paths.after);
    if (!seenBeforePaths.has(paths.before)) {
      seenBeforePaths.add(paths.before);
      beforePaths.push(paths.before);
    }
  }

  return {
    text: kept.join('\n'),
    files,
    beforePaths,
    truncated: droppedFiles > 0,
    droppedFiles,
  };
}
