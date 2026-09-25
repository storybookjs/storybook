import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { HandledError } from 'storybook/internal/common';
import {
  type ConfigFile,
  type CsfFile,
  formatConfig,
  loadConfig,
  loadCsf,
  printCsf,
} from 'storybook/internal/csf-tools';

import { assertConfigMutationSuccess } from './helpers/config-object.ts';

type Transform = (
  source: string,
  path: string
) => string | null | undefined | Promise<string | null | undefined>;

class FixFilesError extends HandledError {}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Staged file edits of a single automigration. Reads see earlier edits of the same fix, and nothing
 * reaches the disk until the automigration runner commits the fix after `run` resolves. The commit
 * refuses to overwrite a file that something else (such as `add()`) changed after the fix read it.
 */
export interface FixFiles {
  /** Read a file, including edits staged earlier by the same fix. */
  read(path: string): Promise<string>;
  /** Stage the complete contents of a file. */
  write(path: string, content: string): void;
  /** Stage the deletion of a file. */
  remove(path: string): void;
  /**
   * Stage the text returned by `transform` for each file, skipping files it leaves unchanged or
   * returns `null`/`undefined` for, and resolve with the changed paths.
   *
   * @throws When `transform` throws for any file, after every file was attempted. The error lists
   *   each failed file.
   */
  edit(paths: string | readonly string[], transform: Transform): Promise<string[]>;
  /**
   * Edit a main, preview, or manager config through the `ConfigFile` API.
   *
   * @throws When the file cannot be parsed or the edit left mutation diagnostics.
   */
  editConfig(path: string, edit: (config: ConfigFile) => unknown): Promise<boolean>;
  /**
   * Edit story files through the `CsfFile` API, and resolve with the changed paths.
   *
   * @throws Like `edit`, including files whose edit left mutation diagnostics.
   */
  editCsf(
    paths: string | readonly string[],
    edit: (csf: CsfFile, path: string) => unknown
  ): Promise<string[]>;
}

export const createFixFiles = () => {
  const staged = new Map<string, { path: string; content: string | null }>();
  const originals = new Map<string, string>();

  const read = async (path: string) => {
    const key = resolve(path);
    const stagedFile = staged.get(key);
    if (stagedFile?.content === null) {
      throw new FixFilesError(`${path} was removed by this migration`);
    }
    if (stagedFile) {
      return stagedFile.content;
    }
    const content = await readFile(path, 'utf-8');
    originals.set(key, content);
    return content;
  };

  const edit: FixFiles['edit'] = async (paths, transform) => {
    const changed: string[] = [];
    const failures: string[] = [];
    const seen = new Set<string>();
    for (const path of typeof paths === 'string' ? [paths] : paths) {
      if (seen.has(resolve(path))) {
        continue;
      }
      seen.add(resolve(path));
      try {
        const source = await read(path);
        const result = await transform(source, path);
        if (result != null && result !== source) {
          staged.set(resolve(path), { path, content: result });
          changed.push(path);
        }
      } catch (error) {
        failures.push(`- ${path}: ${messageOf(error)}`);
      }
    }
    if (failures.length > 0) {
      throw new FixFilesError(`Could not update these files:\n${failures.join('\n')}`);
    }
    return changed;
  };

  const files: FixFiles = {
    read,
    write: (path, content) => staged.set(resolve(path), { path, content }),
    remove: (path) => staged.set(resolve(path), { path, content: null }),
    edit,
    editConfig: async (path, editConfig) => {
      const changed = await edit(path, async (source) => {
        const config = loadConfig(source, path).parse();
        await editConfig(config);
        assertConfigMutationSuccess(config);
        return formatConfig(config);
      });
      return changed.length > 0;
    },
    editCsf: (paths, editCsf) =>
      edit(paths, async (source, path) => {
        const csf = loadCsf(source, {
          fileName: path,
          makeTitle: (title) => title || 'default',
        }).parse();
        await editCsf(csf, path);
        const [diagnostic] = csf.mutationDiagnostics;
        if (diagnostic) {
          throw new FixFilesError(diagnostic.message);
        }
        return printCsf(csf).code;
      }),
  };

  const commit = async () => {
    const overwritten: string[] = [];
    for (const [key, { path }] of staged) {
      const original = originals.get(key);
      if (original !== undefined && original !== (await readFile(path, 'utf-8'))) {
        overwritten.push(`- ${path}`);
      }
    }
    if (overwritten.length > 0) {
      throw new FixFilesError(
        `These files changed on disk after the migration read them, so nothing was written:\n${overwritten.join('\n')}`
      );
    }
    for (const { path, content } of staged.values()) {
      await (content === null ? unlink(path) : writeFile(path, content));
    }
  };

  return { files, commit };
};
