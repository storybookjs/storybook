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

/**
 * Classify every project file once, independent of which hooks are active, so a file keeps its kind
 * whichever fixes run. Stories claim their paths before the config directory glob does.
 */
const collectFiles = async (project: ProjectPaths, kinds: Set<FileKind>) => {
  if (kinds.size === 0) {
    return [];
  }
  const files = new Map<string, TransformContext>();
  const claim = (id: string, kind: FileKind) => {
    if (!files.has(resolve(id))) {
      files.set(resolve(id), { id, kind });
    }
  };

  // Undefined when core cannot locate the main config (for example `main.mts`), like the preview.
  if (project.mainConfigPath) {
    claim(project.mainConfigPath, 'main');
  }
  if (project.previewConfigPath) {
    claim(project.previewConfigPath, 'preview');
  }
  const managerConfigPath = project.configDir && findConfigFile('manager', project.configDir);
  if (managerConfigPath) {
    claim(managerConfigPath, 'manager');
  }
  project.storiesPaths.forEach((id) => claim(id, 'story'));
  if (kinds.has('config')) {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    (await globby(`${project.configDir}/**/*`, { absolute: true, dot: true })).forEach((id) =>
      claim(id, 'config')
    );
  }

  return [...files.values()]
    .filter(({ kind }) => kinds.has(kind))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
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
      try {
        await writeFile(context.id, code);
      } catch (error) {
        for (const [fixId, outcome] of outcomes) {
          if (outcome.changed.includes(context.id)) {
            outcome.changed = outcome.changed.filter((file) => file !== context.id);
            fail(fixId, error);
          }
        }
      }
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

/**
 * Whether a fix that passed `check` is offered after the detection pass. A fix with only `transform`
 * is offered when its hooks change a file or fail on one; failures are reported only once the user
 * selects the fix and the apply pass hits them.
 */
export const appliesAfterDetection = (fix: Fix, outcome: TransformOutcome | undefined) =>
  !fix.transform ||
  !!fix.run ||
  (outcome?.changed.length ?? 0) > 0 ||
  (outcome?.errors.length ?? 0) > 0;
