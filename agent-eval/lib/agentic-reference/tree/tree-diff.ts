// Compare the pinned upstream ref against the collected post-run tree.
//
// This is the authoritative changed-file list, and the only one available. The
// harness cannot supply it: `generatedFiles` is a git diff against a commit
// taken before setup() materialises the external repo, so it contains the whole
// application; and `o11y.filesModified` is transcript-derived, so it misses
// every edit made through the shell.
//
// Both sides are comment- and blank-stripped before diffing, so the counts are
// source lines. That rules out `git diff --numstat`, which only sees the raw
// files, hence the LCS diff here.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { diffLines } from 'diff';

import { isExcludedPath, SKIP_DIRS, SOURCE_EXTENSIONS } from './paths.ts';
import { stripToSloc } from '../metrics/sloc.ts';

export interface SlocDiff {
  added: number;
  removed: number;
  net: number;
}

export interface TreeDiff {
  filesChanged: number;
  /** Workspace-relative paths, sorted. */
  files: string[];
  sloc: SlocDiff;
  /** The same counts per changed file, so consumers can weigh a subset. */
  slocByFile: Record<string, SlocDiff>;
}

function isExcluded(path: string): boolean {
  // Source files only: this metric counts source lines, and stripToSloc has no
  // meaning for a binary asset. (Until the harness patch made the copy-out path
  // byte-exact, binaries also read as changed on every single run.)
  return isExcludedPath(path) || !SOURCE_EXTENSIONS.test(path);
}

/** Workspace-relative, POSIX-separated paths of every candidate source file. */
function collectSourceFiles(dir: string): Set<string> {
  const found = new Set<string>();
  if (!existsSync(dir)) return found;

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(current, entry.name));
        continue;
      }
      const path = relative(dir, join(current, entry.name)).split(sep).join('/');
      if (!isExcluded(path)) found.add(path);
    }
  };

  walk(dir);
  return found;
}

function readStripped(dir: string, path: string): string {
  const full = join(dir, path);
  if (!existsSync(full)) return '';
  try {
    return stripToSloc(readFileSync(full, 'utf8'), path);
  } catch {
    return '';
  }
}

function countLines(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

export function diffTrees(refDir: string, projectDir: string): TreeDiff {
  const candidates = new Set([...collectSourceFiles(refDir), ...collectSourceFiles(projectDir)]);

  const files: string[] = [];
  const slocByFile: Record<string, SlocDiff> = {};
  let added = 0;
  let removed = 0;

  for (const path of candidates) {
    const before = readStripped(refDir, path);
    const after = readStripped(projectDir, path);
    if (before === after) continue;

    let fileAdded = 0;
    let fileRemoved = 0;
    // diffLines needs trailing newlines to treat the last line consistently.
    for (const change of diffLines(
      before === '' ? '' : before + '\n',
      after === '' ? '' : after + '\n'
    )) {
      const lines = countLines(change.value.replace(/\n$/, ''));
      if (change.added) fileAdded += lines;
      else if (change.removed) fileRemoved += lines;
    }

    if (fileAdded === 0 && fileRemoved === 0) continue;
    files.push(path);
    slocByFile[path] = { added: fileAdded, removed: fileRemoved, net: fileAdded - fileRemoved };
    added += fileAdded;
    removed += fileRemoved;
  }

  files.sort();
  return {
    filesChanged: files.length,
    files,
    sloc: { added, removed, net: added - removed },
    slocByFile,
  };
}
