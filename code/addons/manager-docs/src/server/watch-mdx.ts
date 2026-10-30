import { logger } from 'storybook/internal/node-logger';
import Watchpack from 'watchpack';

import { ManagerDocsParseError } from '../errors.ts';
import { parseManagerDocs } from '../parser/parse-mdx.ts';
import type { IndexedEntry } from '../runtime/docs-page.ts';
import { mdxSourceError, type MdxSourceChange } from '../runtime/source-transport.ts';
import { mdxFileInProject } from './read-mdx.ts';

export const MDX_CHANGE_BATCH_MS = 100;

export function docsMdxFiles(entries: IndexedEntry[]): string[] {
  const files = entries.flatMap((entry) =>
    entry.type === 'docs' && entry.importPath?.toLowerCase().endsWith('.mdx')
      ? [entry.importPath]
      : []
  );
  return [...new Set(files)];
}

/**
 * Batch file changes for 100ms, then publish each changed file's source or its parse error.
 *
 * Revisions are per file and taken when the batch fires, so a slow read cannot outrank a later one.
 * A file that cannot be read is skipped; the story index reports removed docs files.
 */
export function createMdxChangePublisher(input: {
  read: (importPath: string) => Promise<string>;
  publish: (change: MdxSourceChange) => void;
}): { queue: (importPath: string) => void; close: () => void } {
  const revisions = new Map<string, number>();
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const publishFile = async (importPath: string, revision: number) => {
    let source: string;
    try {
      source = await input.read(importPath);
    } catch {
      return;
    }
    try {
      parseManagerDocs(source, importPath);
    } catch (error) {
      if (error instanceof ManagerDocsParseError) {
        input.publish({ importPath, revision, error: mdxSourceError(error) });
      } else {
        logger.warn(`Manager docs could not parse ${importPath}: ${String(error)}`);
      }
      return;
    }
    input.publish({ importPath, revision, source });
  };

  const flush = () => {
    timer = undefined;
    const files = [...pending];
    pending.clear();
    return Promise.all(
      files.map((importPath) => {
        const revision = (revisions.get(importPath) ?? 0) + 1;
        revisions.set(importPath, revision);
        return publishFile(importPath, revision);
      })
    );
  };

  return {
    queue(importPath) {
      pending.add(importPath);
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(flush, MDX_CHANGE_BATCH_MS);
    },
    close() {
      if (timer) {
        clearTimeout(timer);
      }
      pending.clear();
    },
  };
}

/**
 * Watch the given MDX import paths and publish their source when they change on disk.
 *
 * Call `watch` again with a new list to replace the watched files.
 */
export function watchMdxSources(input: {
  projectRoot: string;
  read: (importPath: string) => Promise<string>;
  publish: (change: MdxSourceChange) => void;
}): { watch: (importPaths: string[]) => void; close: () => void } {
  const publisher = createMdxChangePublisher(input);
  const importPaths = new Map<string, string>();
  const wp = new Watchpack({ followSymlinks: false, ignored: ['**/.git', '**/node_modules'] });
  wp.on('change', (absolutePath: string, mtime: number) => {
    const importPath = importPaths.get(absolutePath);
    if (importPath && mtime) {
      publisher.queue(importPath);
    }
  });

  return {
    watch(next) {
      importPaths.clear();
      for (const importPath of next) {
        importPaths.set(mdxFileInProject(input.projectRoot, importPath), importPath);
      }
      wp.watch({ files: [...importPaths.keys()], directories: [] });
    },
    close() {
      publisher.close();
      wp.close();
    },
  };
}
