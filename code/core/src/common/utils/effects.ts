import {
  existsSync as diskExistsSync,
  readFileSync as diskReadFileSync,
  rmSync,
  writeFileSync as diskWriteFileSync,
} from 'node:fs';
import { readFile as diskReadFile, rm, writeFile as diskWriteFile } from 'node:fs/promises';

import { CLI_COLORS, logger } from 'storybook/internal/node-logger';

import { extname, resolve } from 'pathe';
import { parse as parseYaml } from 'yaml';

import { getProjectRelativePath } from './paths.ts';

/**
 * The side effects of a CLI command on the project: writing and removing files, and steps such as
 * an install that change it in ways a file write cannot stage.
 *
 * Code that changes the project goes through this module and does not check whether the command
 * is a dry run. A command turns a dry run on once, with {@link setDryRun}. Then writes are staged in
 * memory, reads return the staged content, and steps are recorded instead of run, so a dry run takes
 * the same path as a run and {@link logDryRunChanges} lists what the run would change.
 */

type JournalEntry =
  | { kind: 'file'; path: string }
  | { kind: 'step'; description: string }
  | { kind: 'command'; command: string };

interface EffectsState {
  dryRun: boolean;
  /** The content of each staged file by absolute path, `null` for a removed one. */
  staged: Map<string, string | null>;
  /** The files and steps of a dry run, in the order it met them. */
  journal: JournalEntry[];
}

// One state for the process, even when several bundles include this module.
const state: EffectsState = ((
  globalThis as { __STORYBOOK_EFFECTS__?: EffectsState }
).__STORYBOOK_EFFECTS__ ??= { dryRun: false, staged: new Map(), journal: [] });
const { staged, journal } = state;

/** Turn the dry run on or off for the rest of the command, and forget what an earlier one staged. */
export const setDryRun = (enabled: boolean) => {
  state.dryRun = enabled;
  staged.clear();
  journal.length = 0;
};

/** Whether the command is a dry run, for the few steps that report outcomes instead of effects. */
export const isDryRun = () => state.dryRun;

const keyOf = (path: string) => resolve(String(path));

const notFound = (path: string) =>
  Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), {
    code: 'ENOENT',
    path,
  });

const stage = (path: string, content: string | null) => {
  const key = keyOf(path);
  if (!staged.has(key)) {
    journal.push({ kind: 'file', path: key });
  }
  staged.set(key, content);
};

/** Read a project file as text, with the content a dry run staged for it. */
export const readFileSync = (path: string): string => {
  const key = keyOf(path);
  if (staged.has(key)) {
    const content = staged.get(key);
    if (content === null || content === undefined) {
      throw notFound(path);
    }
    return content;
  }
  return diskReadFileSync(path, 'utf8');
};

/** Read a project file as text, with the content a dry run staged for it. */
export const readFile = async (path: string): Promise<string> => {
  const key = keyOf(path);
  if (staged.has(key)) {
    return readFileSync(path);
  }
  return diskReadFile(path, 'utf8');
};

/** Whether a project file exists, counting the files a dry run staged or removed. */
export const existsSync = (path: string): boolean => {
  const key = keyOf(path);
  return staged.has(key) ? staged.get(key) !== null : diskExistsSync(path);
};

/** Write a project file, or stage it in a dry run. */
export const writeFileSync = (path: string, content: string): void => {
  if (state.dryRun) {
    stage(path, content);
    return;
  }
  diskWriteFileSync(path, content);
};

/** Write a project file, or stage it in a dry run. */
export const writeFile = async (path: string, content: string): Promise<void> => {
  if (state.dryRun) {
    stage(path, content);
    return;
  }
  await diskWriteFile(path, content);
};

/** Remove a project file if it exists, or stage its removal in a dry run. */
export const removeFile = async (path: string): Promise<void> => {
  if (state.dryRun) {
    if (existsSync(path)) {
      stage(path, null);
    }
    return;
  }
  await rm(path, { force: true });
};

/** Remove a project file if it exists, or stage its removal in a dry run. */
export const removeFileSync = (path: string): void => {
  if (state.dryRun) {
    if (existsSync(path)) {
      stage(path, null);
    }
    return;
  }
  rmSync(path, { force: true });
};

/**
 * Run a step that changes the project in a way a file write cannot stage, such as an install, or
 * that needs such a step first. A dry run records `description` instead, worded to follow "An
 * actual run would", and resolves to `undefined`.
 */
export const runStep = async <T>(
  description: string,
  run: () => T | Promise<T>
): Promise<T | undefined> => record({ kind: 'step', description }, run);

/** {@link runStep} for a shell command, recorded in a dry run as "run <command>". */
export const runCommand = async <T>(
  command: string,
  run: () => T | Promise<T>
): Promise<T | undefined> => record({ kind: 'command', command }, run);

const record = async <T>(entry: JournalEntry, run: () => T | Promise<T>) => {
  if (state.dryRun) {
    journal.push(entry);
    return undefined;
  }
  return run();
};

const MAX_DETAILS = 12;
const MAX_VALUE_LENGTH = 60;

const parseStructured = (path: string, content: string | undefined): unknown => {
  if (content === undefined) {
    return {};
  }
  const extension = extname(path);
  try {
    if (extension === '.json') {
      return JSON.parse(content);
    }
    if (extension === '.yaml' || extension === '.yml') {
      return parseYaml(content) ?? {};
    }
  } catch {
    // A file that does not parse is listed without its changes.
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const flatten = (value: unknown, prefix = '', into = new Map<string, string>()) => {
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, into);
    }
  } else if (prefix) {
    into.set(prefix, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return into;
};

const shorten = (value: string) =>
  value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…` : value;

// The keys of a JSON or YAML file that a change sets, adds or removes, one line each.
const describeStructuredChanges = (path: string, before: string | undefined, after: string) => {
  const parsedBefore = parseStructured(path, before);
  const parsedAfter = parseStructured(path, after);
  if (parsedBefore === undefined || parsedAfter === undefined) {
    return [];
  }
  const old = flatten(parsedBefore);
  const next = flatten(parsedAfter);
  const lines: string[] = [];
  for (const [key, value] of next) {
    const previous = old.get(key);
    if (previous === undefined) {
      lines.push(`+ ${key}: ${shorten(value)}`);
    } else if (previous !== value) {
      lines.push(`${key}: ${shorten(previous)} → ${shorten(value)}`);
    }
  }
  for (const key of old.keys()) {
    if (!next.has(key)) {
      lines.push(`- ${key}`);
    }
  }
  return lines.length > MAX_DETAILS
    ? [...lines.slice(0, MAX_DETAILS), `… and ${lines.length - MAX_DETAILS} more`]
    : lines;
};

const readDisk = (path: string) =>
  diskExistsSync(path) ? diskReadFileSync(path, 'utf8') : undefined;

/**
 * What a run would change, as lines that follow "An actual run would:": one for each file it would create,
 * update or delete, by path, then one for each step it would run, in the order the dry run met them. A JSON or YAML file
 * also lists the keys it would change. Files a run would write with their current content are left
 * out.
 */
export const describeDryRunChanges = (): string[] => {
  const files = journal
    .flatMap((entry) => (entry.kind === 'file' ? [entry.path] : []))
    .map((path) => ({ path, shown: getProjectRelativePath(path) }))
    .sort((a, b) => a.shown.localeCompare(b.shown));
  const steps = journal.flatMap((entry) => {
    if (entry.kind === 'step') {
      return [entry.description];
    }
    return entry.kind === 'command' ? [`run ${CLI_COLORS.dryRunChange(entry.command)}`] : [];
  });
  return [...files.flatMap(describeFileChange), ...steps];
};

const describeFileChange = (entry: { path: string; shown: string }): string[] => {
  const content = staged.get(entry.path);
  const before = readDisk(entry.path);
  if (content === before || (content === null && before === undefined)) {
    return [];
  }
  const file = CLI_COLORS.dryRunChange(entry.shown);
  if (content === null || content === undefined) {
    return [`delete ${file}`];
  }
  // The logger trims leading spaces, so a detail line starts with a mark instead.
  const details = describeStructuredChanges(entry.path, before, content).map((line) => `↳ ${line}`);
  return [`${before === undefined ? 'create' : 'update'} ${file}`, ...details];
};

/** In a dry run, log what a run would change, if anything, under "Dry run finished. An actual run would:". */
export const logDryRunChanges = () => {
  const changes = state.dryRun ? describeDryRunChanges() : [];
  if (changes.length > 0) {
    logger.step(CLI_COLORS.dryRun('Dry run finished. An actual run would:'));
    logger.log(changes.join('\n'));
  }
};
