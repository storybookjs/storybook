import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { findConfigFile } from 'storybook/internal/common';
import { type ConfigFile, formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import { assertConfigMutationSuccess } from './helpers/config-object.ts';
import type { Fix, TransformOptions } from './types.ts';

/** Where a file sits in a Storybook project. Files are visited in this order. */
export type FileKind = 'main' | 'preview' | 'manager' | 'config' | 'story';

const KIND_ORDER: readonly FileKind[] = ['main', 'preview', 'manager', 'config', 'story'];

export interface TransformContext {
  id: string;
  kind: FileKind;
}

/**
 * A per-file transform, modelled on Vite's `transform` hook. `handler` receives the output of the
 * fixes before it and returns new code, or `null`/`undefined` to leave the file unchanged. A throw
 * fails the fix for that file without affecting the other fixes.
 */
export interface FixTransform {
  filter: { kind: readonly FileKind[]; id?: RegExp };
  handler: (
    code: string,
    context: TransformContext
  ) => string | null | undefined | Promise<string | null | undefined>;
}

export interface TransformPlugin {
  fixId: string;
  hooks: FixTransform[];
}

export interface FileFailure {
  file: string;
  message: string;
}

export interface TransformOutcome {
  changed: string[];
  errors: FileFailure[];
}

interface ProjectPaths {
  configDir: string;
  mainConfigPath: string;
  previewConfigPath?: string;
  storiesPaths: string[];
}

/** Apply a `ConfigFile` edit to config source, for use inside a `transform` handler. */
export const editConfigSource = async (
  code: string,
  id: string,
  edit: (config: ConfigFile) => unknown
) => {
  const config = loadConfig(code, id).parse();
  await edit(config);
  assertConfigMutationSuccess(config);
  return formatConfig(config);
};

const collectFiles = async (project: ProjectPaths, kinds: Set<FileKind>) => {
  const byKind: Record<FileKind, () => Promise<string[]>> = {
    main: async () => [project.mainConfigPath],
    preview: async () => (project.previewConfigPath ? [project.previewConfigPath] : []),
    manager: async () => {
      const managerConfigPath = findConfigFile('manager', project.configDir);
      return managerConfigPath ? [managerConfigPath] : [];
    },
    config: async () => {
      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      return globby(`${project.configDir}/**/*`, { absolute: true, dot: true });
    },
    story: async () => project.storiesPaths,
  };

  const files: TransformContext[] = [];
  const seen = new Set<string>();
  for (const kind of KIND_ORDER.filter((kind) => kinds.has(kind))) {
    for (const id of await byKind[kind]()) {
      if (!seen.has(resolve(id))) {
        seen.add(resolve(id));
        files.push({ id, kind });
      }
    }
  }
  return files;
};

/**
 * Stream a project's files through every plugin's hooks: each file is read once, passed through
 * the hooks in plugin order, and written at most once before the next file is read.
 */
export const runTransforms = async (
  project: ProjectPaths,
  plugins: TransformPlugin[],
  { write }: { write: boolean }
) => {
  const outcomes = new Map<string, TransformOutcome>(
    plugins.map(({ fixId }) => [fixId, { changed: [], errors: [] }])
  );
  const kinds = new Set(plugins.flatMap(({ hooks }) => hooks.flatMap(({ filter }) => filter.kind)));

  for (const context of await collectFiles(project, kinds)) {
    const active = plugins.flatMap(({ fixId, hooks }) =>
      hooks
        .filter(
          ({ filter }) =>
            filter.kind.includes(context.kind) && (!filter.id || filter.id.test(context.id))
        )
        .map((hook) => ({ fixId, hook }))
    );
    if (active.length === 0) {
      continue;
    }

    const fail = (fixId: string, error: unknown) =>
      outcomes.get(fixId)!.errors.push({
        file: context.id,
        message: error instanceof Error ? error.message : String(error),
      });

    let source: string;
    try {
      source = await readFile(context.id, 'utf-8');
    } catch (error) {
      new Set(active.map(({ fixId }) => fixId)).forEach((fixId) => fail(fixId, error));
      continue;
    }

    let code = source;
    for (const { fixId, hook } of active) {
      const outcome = outcomes.get(fixId)!;
      try {
        const result = await hook.handler(code, context);
        if (result != null && result !== code) {
          code = result;
          if (!outcome.changed.includes(context.id)) {
            outcome.changed.push(context.id);
          }
        }
      } catch (error) {
        fail(fixId, error);
      }
    }

    if (write && code !== source) {
      await writeFile(context.id, code);
    }
  }

  return outcomes;
};

/** Instantiate the hooks of every fix in `fixes` that declares `transform`, for one project. */
export const pluginsFor = (
  fixes: { fix: Fix; result: unknown }[],
  project: Omit<TransformOptions<unknown>, 'result'>
): TransformPlugin[] =>
  fixes.flatMap(({ fix, result }) =>
    fix.transform ? [{ fixId: fix.id, hooks: fix.transform({ ...project, result }) }] : []
  );

/** The check of a transform fix without its own gate: detection decides from the hooks' output. */
export const applies = async () => ({});
