import { readFileSync, readdirSync } from 'node:fs';

import { basename, dirname, join, relative, resolve } from 'pathe';

import { getProjectRoot } from './paths.ts';

/** The config files Vitest loads on its own from a directory, in the order it tries them. */
const DEFAULT_CONFIG_FILES = ['vitest.config', 'vite.config'].flatMap((base) =>
  ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map((ext) => `${base}.${ext}`)
);

/**
 * Any Vite or Vitest config file name: the defaults, and the dedicated configs projects point
 * Vitest's `--config` at, such as `vitest.storybook.config.ts`.
 */
const CONFIG_FILE_PATTERN = /^(vitest|vite)(\.[\w-]+)*\.config\.(m|c)?(t|j)sx?$/;

/** The file names the search looks for, for messages that say what was looked for. */
export const STORYBOOK_VITEST_CONFIG_NAMES =
  'vitest.config.*, vite.config.*, vitest.*.config.*, vite.*.config.*';

export type StorybookVitestConfig = {
  /**
   * The Vitest config that registers the `storybookTest` plugin for this Storybook, if one was
   * found: inside the config dir, or with a `configDir` option that names it. With `loose`, the
   * nearest config that uses the plugin at all.
   */
  configFile?: string;
  /**
   * Whether `configFile` was matched only loosely: it uses the plugin, but its `configDir` option
   * could not be read as this Storybook's (for example, computed from a variable). Good enough to
   * start Vitest with, as before, but not to turn on `@storybook/addon-vitest` for this Storybook.
   */
  loose?: boolean;
  /**
   * The root to start Vitest in: the directory of `configFile`, or the package root (the parent of
   * the Storybook config directory) when the config lives inside the Storybook config directory.
   */
  root?: string;
  /**
   * Whether Vitest must be given `configFile` explicitly. False for a `vitest.config.*` or
   * `vite.config.*` in `root` that Vitest loads by itself: there Vitest's own choice is kept, as
   * when the project runs `vitest` in that directory, so a `vitest.config.ts` that merges the
   * `vite.config.ts` with the plugin still applies.
   */
  explicit: boolean;
  /**
   * The config Vitest loads: `configFile` when it is passed explicitly, else the config Vitest
   * picks by itself in `root`, which can be a `vitest.config.*` next to the `vite.config.*` with the
   * plugin.
   */
  loads?: string;
  /** The directories searched, nearest first. */
  searched: string[];
  /** Vite and Vitest configs found along the way that do not register the plugin for it. */
  others: string[];
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The source without comments, so a commented-out plugin or a note about it does not count. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** Whether `content` names `path` (with either slash), as whole path segments. */
const namesPath = (content: string, path: string) =>
  path.length > 0 &&
  new RegExp(`(^|[^\\w.-])${path.split('/').map(escapeRegExp).join('[\\\\/]+')}(?![\\w.-])`).test(
    content
  );

/**
 * How `file` registers the `storybookTest` plugin for the Storybook in `storybookDir`, read from its
 * source: `strict` when the config is for that Storybook, `loose` when it uses the plugin but not
 * recognisably for that Storybook, or `false`.
 *
 * A config inside the config dir is for that Storybook. Elsewhere, the plugin's `configDir` option
 * must name the config dir: by folder name for a config in the package root, where a plugin without
 * `configDir` runs `<cwd>/.storybook` and so counts for a config dir named `.storybook`; and by its
 * path from the config's folder for a config above the package root, so the root config of a
 * monorepo never counts for every package that has a `.storybook`.
 */
const registration = (file: string, storybookDir: string): 'strict' | 'loose' | false => {
  let content: string;
  try {
    content = stripComments(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
  if (!/\bstorybookTest\s*\(/.test(content) && !content.includes('addon-vitest/vitest-plugin')) {
    return false;
  }
  const directory = dirname(file);
  if (directory === storybookDir) {
    return 'strict';
  }
  if (directory === dirname(storybookDir)) {
    if (!/\bconfigDir\b/.test(content)) {
      return basename(storybookDir) === '.storybook' ? 'strict' : 'loose';
    }
    return namesPath(content, basename(storybookDir)) ? 'strict' : 'loose';
  }
  return namesPath(content, relative(directory, storybookDir)) ? 'strict' : 'loose';
};

/** Config files in `directory`, the ones Vitest loads by itself first, in its order. */
const configFilesIn = (directory: string): string[] => {
  let fileNames: string[];
  try {
    fileNames = readdirSync(directory).filter((name) => CONFIG_FILE_PATTERN.test(name));
  } catch {
    return [];
  }
  const rank = (name: string) => {
    const index = DEFAULT_CONFIG_FILES.indexOf(name);
    return index === -1 ? DEFAULT_CONFIG_FILES.length : index;
  };
  return fileNames
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((name) => join(directory, name));
};

/** The config Vitest loads by itself when started in `directory`, if any. */
export const defaultVitestConfigIn = (directory: string): string | undefined =>
  configFilesIn(directory).find((file) => DEFAULT_CONFIG_FILES.includes(basename(file)));

/** Whether `child` is `parent` or inside it. */
const isWithin = (parent: string, child: string) => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !/^([a-zA-Z]:)?\//.test(path));
};

function located(file: string, directory: string, storybookDir: string) {
  const root = directory === storybookDir ? dirname(storybookDir) : directory;
  const loads = defaultVitestConfigIn(root);
  // Passed explicitly unless Vitest would load a config from `root` by itself and `file` is one
  // Vitest picks by name, so Vitest's own choice is kept (and reported in `loads`).
  const explicit = directory !== root || !loads || !DEFAULT_CONFIG_FILES.includes(basename(file));
  return { configFile: file, root, explicit, loads: explicit ? file : loads };
}

/**
 * Finds the Vitest config that runs the stories of the Storybook in `configDir`: the nearest Vite
 * or Vitest config that registers the `storybookTest` plugin of `@storybook/addon-vitest` for that
 * Storybook, or else the nearest that uses the plugin at all (`loose`).
 *
 * It looks in the package root (the parent of `configDir`) first, then in `configDir` itself,
 * then upward to the project root, so a Storybook-only config next to `main.ts` (such as
 * `.storybook/vitest.config.ts`) and a dedicated config (such as `vitest.storybook.config.ts`)
 * are found as well as the `vitest.config.ts` or `vite.config.ts` of the package or of a
 * monorepo root. Whether a file registers the plugin is read from its source, so a config that
 * only reaches the plugin through another file it imports is not recognised.
 */
export function findStorybookVitestConfig({
  configDir,
  projectRoot = getProjectRoot(),
}: {
  configDir: string;
  projectRoot?: string;
}): StorybookVitestConfig {
  const storybookDir = resolve(configDir);
  const packageRoot = dirname(storybookDir);
  const last = resolve(projectRoot);

  const directories = [packageRoot, storybookDir];
  // Up from the package root to the project root; when the package lies outside the project
  // root, the package root alone.
  if (isWithin(last, packageRoot)) {
    for (let dir = packageRoot; dir !== last;) {
      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      directories.push(parent);
      dir = parent;
    }
  }

  const others: string[] = [];
  let looseMatch: { file: string; directory: string } | undefined;
  for (const directory of directories) {
    for (const file of configFilesIn(directory)) {
      const match = registration(file, storybookDir);
      if (match === 'strict') {
        return { ...located(file, directory, storybookDir), searched: directories, others };
      }
      if (match === 'loose') {
        looseMatch ??= { file, directory };
      }
      others.push(file);
    }
  }

  if (looseMatch) {
    return {
      ...located(looseMatch.file, looseMatch.directory, storybookDir),
      loose: true,
      searched: directories,
      others,
    };
  }
  return { searched: directories, others, explicit: false };
}
