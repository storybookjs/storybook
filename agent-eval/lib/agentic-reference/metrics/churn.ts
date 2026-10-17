// How many times the agent rewrote each file. Fewer passes over the same file
// suggests it understood the change before making it. Higher file churn is
// usually indicative of lower code quality.
//
// Both shell writes and structured Edit/Write calls are counted, and renames
// are accounted for. Files are keyed under their final path. Temporary files
// count too, deliberately. If an agent generates temporary test probes, those
// are acts of editing that were required.
//
// Inline interpreter scripts (`node -e`, `python3 -` heredocs) are covered by
// a best-effort scan: only writes to a literal path — direct or one variable
// hop away — are seen. A script that computes its target dynamically still
// churns invisibly.
import { isRecord } from '../../utils/type.ts';
import { splitCommandSegments } from '../../utils/shell-segments.ts';
import { detectInlineScriptWrites } from './inline-script-writes.ts';

export interface Rename {
  from: string;
  to: string;
}

export interface ChurnMetrics {
  /**
   * Workspace-relative path to number of write operations, keyed by the file's
   * *final* path. A renamed file carries its history with it.
   */
  perFile: Record<string, number>;
  filesEdited: number;
  /** null when no file was edited — distinct from an average that came out 0. */
  maxEditsPerFile: number | null;
  meanEditsPerFile: number | null;
  /** Renames observed, in order, so a merged history can be traced back. */
  renames: Rename[];
}

/**
 * Binaries whose *last* path argument is the file being written.
 *
 * `mv` is deliberately absent: it is handled as a rename, and leaving it here
 * would count the destination twice.
 */
const WRITES_LAST_ARGUMENT = new Set(['cp', 'tee', 'touch', 'ln']);
/** Binaries where every path argument is affected. */
const WRITES_EVERY_ARGUMENT = new Set(['rm', 'mkdir', 'chmod']);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Absolute prefixes a run's workspace has been mounted at. The Docker sandbox
 * used by real runs mounts it at /home/sandbox/workspace/; /workspace/ is kept
 * for older transcripts. Passing computeChurn a single string still works.
 */
export const WORKSPACE_ROOTS = ['/home/sandbox/workspace/', '/workspace/'] as const;

function isPathLike(token: string): boolean {
  return token !== '' && !token.startsWith('-');
}

/**
 * Workspace-relative form of a path, or null when it lies outside the workspace.
 * Absolute paths elsewhere (/tmp) are scratch space, not the codebase under
 * evaluation.
 */
function normalize(rawPath: string, workspaceRoots: readonly string[]): string | null {
  const path = rawPath.replace(/^['"]|['"]$/g, '');
  for (const root of workspaceRoots) {
    if (path.startsWith(root)) return path.slice(root.length);
  }
  if (path.startsWith('/')) return null;
  return path.replace(/^\.\//, '');
}

/**
 * One thing the agent did to a file. `write` counts against the path; `rename`
 * moves the path's accumulated history to a new one.
 *
 * Operations are kept as an ordered stream rather than tallied as they are
 * found, because a rename rewrites history that precedes it: the two edits
 * before `mv a.ts b.ts` belong to `b.ts`, and that is only knowable once the
 * move is seen.
 */
type Operation = { kind: 'write'; path: string } | { kind: 'rename'; from: string; to: string };

/** `mv a.ts b.ts dir/` — several sources into a directory, rather than a rename. */
function movesIntoDirectory(paths: string[]): boolean {
  return paths.length > 2 || (paths.at(-1) ?? '').endsWith('/');
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function collectShellOperations(
  command: string,
  workspaceRoots: readonly string[],
  into: Operation[]
): void {
  const write = (rawPath: string | undefined): void => {
    if (rawPath === undefined) return;
    const normalized = normalize(rawPath, workspaceRoots);
    if (normalized !== null) into.push({ kind: 'write', path: normalized });
  };

  // Writes made from inside `node -e` / `python3 -` scripts, which the
  // segment walk below cannot see.
  for (const path of detectInlineScriptWrites(command).paths) {
    write(path);
  }

  for (const segment of splitCommandSegments(command)) {
    if (segment.piped) continue;

    // The splitter has already discarded `2>` and `/dev/null` targets, so a
    // non-null target here is a genuine content write.
    if (segment.redirectTarget !== null) write(segment.redirectTarget);

    let index = 0;
    const { tokens } = segment;
    while (index < tokens.length && ENV_ASSIGNMENT.test(tokens[index] ?? '')) index += 1;
    let head = (tokens[index] ?? '').replace(/^.*\//, '');
    let args = tokens.slice(index + 1);

    // `git mv` renames exactly as `mv` does.
    if (head === 'git' && args[0] === 'mv') {
      head = 'mv';
      args = args.slice(1);
    }

    if (head === 'sed' || head === 'awk') {
      if (!args.some((token) => token === '-i' || token.startsWith('-i'))) continue;
      // The last path-like argument is the file edited in place; the ones
      // before it are the script and its flags.
      write(args.filter(isPathLike).at(-1));
      continue;
    }

    if (head === 'mv') {
      const paths = args.filter(isPathLike);
      const destination = paths.at(-1);
      if (destination === undefined || paths.length < 2) continue;

      const sources = paths.slice(0, -1);
      for (const source of sources) {
        const from = normalize(source, workspaceRoots);
        const rawTo = movesIntoDirectory(paths)
          ? `${destination.replace(/\/$/, '')}/${basename(source)}`
          : destination;
        const to = normalize(rawTo, workspaceRoots);

        // A move out of the workspace is not a rename we can follow; the
        // source's history stays where it is rather than vanishing.
        if (from === null || to === null) continue;
        into.push({ kind: 'rename', from, to });
      }
      continue;
    }

    if (WRITES_LAST_ARGUMENT.has(head)) {
      write(args.filter(isPathLike).at(-1));
      continue;
    }

    if (WRITES_EVERY_ARGUMENT.has(head)) {
      for (const token of args.filter(isPathLike)) write(token);
    }
  }
}

export function computeChurn(
  events: unknown[],
  workspaceRoots: string | readonly string[] = WORKSPACE_ROOTS
): ChurnMetrics {
  const roots = typeof workspaceRoots === 'string' ? [workspaceRoots] : workspaceRoots;
  const operations: Operation[] = [];

  for (const event of events) {
    if (!isRecord(event) || event.type !== 'tool_call' || !isRecord(event.tool)) continue;
    const { name, args } = event.tool;

    if ((name === 'file_edit' || name === 'file_write') && isRecord(args)) {
      const filePath = args.file_path;
      if (typeof filePath === 'string') {
        const normalized = normalize(filePath, roots);
        if (normalized !== null) operations.push({ kind: 'write', path: normalized });
      }
      continue;
    }

    if (name === 'shell' && isRecord(args) && typeof args.command === 'string') {
      collectShellOperations(args.command, roots, operations);
    }
  }

  const counts = new Map<string, number>();
  const renames: Rename[] = [];

  for (const operation of operations) {
    if (operation.kind === 'write') {
      counts.set(operation.path, (counts.get(operation.path) ?? 0) + 1);
      continue;
    }

    // The move itself is an operation the agent performed, counted like any
    // other write. Renaming onto an existing path merges both histories:
    // afterwards there is one file, so there is one count.
    const carried = counts.get(operation.from) ?? 0;
    counts.set(operation.to, (counts.get(operation.to) ?? 0) + carried + 1);
    counts.delete(operation.from);
    renames.push({ from: operation.from, to: operation.to });
  }

  const perFile = Object.fromEntries(counts);
  const values = [...counts.values()];
  return {
    perFile,
    filesEdited: values.length,
    maxEditsPerFile: values.length === 0 ? null : Math.max(...values),
    meanEditsPerFile:
      values.length === 0 ? null : values.reduce((sum, count) => sum + count, 0) / values.length,
    renames,
  };
}
