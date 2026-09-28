import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { findConfigFile, formatFileContent, HandledError } from 'storybook/internal/common';
import {
  type ConfigFile,
  type CsfFile,
  formatConfig,
  loadConfig,
  loadCsf,
  printCsf,
} from 'storybook/internal/csf-tools';

import type { Fix, TransformOptions } from './types.ts';

/** Where a file sits in a Storybook project. Files are visited in this order. */
export type FileKind = 'main' | 'preview' | 'manager' | 'config' | 'story';

const KIND_ORDER: readonly FileKind[] = ['main', 'preview', 'manager', 'config', 'story'];

export interface TransformContext {
  id: string;
  kind: FileKind;
}

type Handler = (
  code: string,
  context: TransformContext
) => string | null | undefined | Promise<string | null | undefined>;

type Edit<File> = (file: File, context: TransformContext) => unknown;

/**
 * A per-file transform, modelled on Vite's `transform` hook. `filter.code` skips files whose current
 * code does not contain it.
 *
 * `handler` rewrites the code as text: it receives the output of the fixes before it and returns new
 * code, or `null`/`undefined` to leave the file unchanged. `editConfig` (main, preview, manager, and
 * other config-directory files) and `editCsf` (story files) edit the parsed file instead; consecutive
 * edits share one parse, and the runner prints the result.
 *
 * A handler or edit that throws, or an edit that leaves mutation diagnostics, fails the fix for that
 * file without affecting the other fixes.
 */
export type FixTransform = {
  filter: { kind: readonly FileKind[]; id?: RegExp; code?: string | RegExp };
} & (
  | { handler: Handler; editConfig?: never; editCsf?: never }
  | { handler?: never; editConfig?: Edit<ConfigFile>; editCsf?: Edit<CsfFile> }
);

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

type Parsed = { config: ConfigFile } | { csf: CsfFile };

const parse = (code: string, { id, kind }: TransformContext): Parsed =>
  kind === 'story'
    ? { csf: loadCsf(code, { fileName: id, makeTitle: (title) => title || id }).parse() }
    : { config: loadConfig(code, id).parse() };

const hasHookFor = (hook: FixTransform, { kind }: TransformContext) =>
  !!(hook.handler ?? (kind === 'story' ? hook.editCsf : hook.editConfig));

const matchesCode = (filter: FixTransform['filter'], code: string) =>
  !filter.code ||
  (typeof filter.code === 'string' ? code.includes(filter.code) : filter.code.test(code));

/**
 * Run one edit on the parsed file and resolve with the printed file. `changed` misses the legacy
 * `ConfigFile` mutators, so the runner compares the printed code instead.
 */
const edit = async (hook: FixTransform, context: TransformContext, parsed: Parsed) => {
  const file = 'csf' in parsed ? parsed.csf : parsed.config;
  const diagnosticsBefore = file.mutationDiagnostics.length;
  await ('csf' in parsed
    ? hook.editCsf!(parsed.csf, context)
    : hook.editConfig!(parsed.config, context));
  const diagnostics = file.mutationDiagnostics.slice(diagnosticsBefore);
  if (diagnostics.length > 0) {
    const messages = diagnostics.map(({ message, loc }) =>
      loc ? `line ${loc.start.line}: ${message}` : message
    );
    throw new HandledError([...new Set(messages)].join('; '));
  }
  return 'csf' in parsed ? printCsf(parsed.csf).code : formatConfig(parsed.config);
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
 *
 * Without `write`, the pass only detects: a plugin stops once it has changed or failed on one
 * file, and the pass stops reading once every plugin has.
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
  const detected = (fixId: string) => {
    const { changed, errors } = outcomes.get(fixId)!;
    return changed.length > 0 || errors.length > 0;
  };

  for (const context of await collectFiles(project, kinds)) {
    const pending = write ? plugins : plugins.filter(({ fixId }) => !detected(fixId));
    if (pending.length === 0) {
      break;
    }
    const active = pending.flatMap(({ fixId, hooks }) =>
      hooks
        .filter(
          (hook) =>
            hook.filter.kind.includes(context.kind) &&
            (!hook.filter.id || hook.filter.id.test(context.id)) &&
            hasHookFor(hook, context)
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
    // Kept across consecutive edits; dropped when a handler rewrites the text or an edit fails, so
    // the next edit parses `code`, the output of the last hook that succeeded.
    let parsed: Parsed | undefined;
    // Printing an AST drifts from the project's style; a text handler keeps it.
    let printed = false;
    for (const { fixId, hook } of active) {
      if (!matchesCode(hook.filter, code)) {
        continue;
      }
      const outcome = outcomes.get(fixId)!;
      try {
        const result = hook.handler
          ? await hook.handler(code, context)
          : await edit(hook, context, (parsed ??= parse(code, context)));
        if (result != null && result !== code) {
          code = result;
          if (hook.handler) {
            parsed = undefined;
          } else {
            printed = true;
          }
          if (!outcome.changed.includes(context.id)) {
            outcome.changed.push(context.id);
          }
        }
      } catch (error) {
        parsed = undefined;
        fail(fixId, error);
      }
    }

    if (write && code !== source) {
      try {
        await writeFile(context.id, printed ? await formatFileContent(context.id, code) : code);
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
 * The detection pass: the checked fixes to offer. A fix with hooks and no `run` is offered only when
 * a hook changes a file or fails on one, and failures are reported once the apply pass hits them.
 * Every other checked fix is offered on its check alone, so its hooks do not run here.
 */
export const detectApplicable = async <Checked extends { fix: Fix; result: unknown }>(
  project: ProjectPaths & Omit<TransformOptions<unknown>, 'result'>,
  checked: Checked[]
): Promise<Checked[]> => {
  const undecided = checked.filter(({ fix }) => fix.transform && !fix.run);
  const outcomes = await runTransforms(project, pluginsFor(undecided, project), { write: false });
  return checked.filter(({ fix }) => {
    const outcome = outcomes.get(fix.id);
    return (
      !undecided.some((check) => check.fix === fix) ||
      outcome!.changed.length > 0 ||
      outcome!.errors.length > 0
    );
  });
};
