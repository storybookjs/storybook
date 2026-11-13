import { readFileSync, readdirSync } from 'node:fs';

import { basename, dirname, join, resolve } from 'pathe';

import { getProjectRoot } from './paths.ts';

const EXTENSIONS = ['mts', 'mjs', 'cts', 'cjs', 'ts', 'tsx', 'js', 'jsx'];

/** The config files Vitest loads on its own from a directory, in the order it tries them. */
const DEFAULT_CONFIG_FILES = ['vitest.config', 'vite.config'].flatMap((base) =>
  EXTENSIONS.map((ext) => `${base}.${ext}`)
);

/**
 * Any Vite or Vitest config file name: the defaults, and the dedicated configs projects point
 * Vitest's `--config` at, such as `vitest.storybook.config.ts`.
 */
const CONFIG_FILE_PATTERN = new RegExp(
  `^(vitest|vite)(\\.[\\w-]+)*\\.config\\.(${EXTENSIONS.join('|')})$`
);

/** The file names the search looks for, for messages that say what was looked for. */
export const STORYBOOK_VITEST_CONFIG_NAMES =
  'vitest.config.*, vite.config.*, vitest.*.config.*, vite.*.config.*';

export type StorybookVitestConfig = {
  /** The Vitest config that registers the `storybookTest` plugin, if one was found. */
  configFile?: string;
  /**
   * The root to start Vitest in: the directory of `configFile`, or the package root (the parent of
   * the Storybook config directory) when the config lives inside the Storybook config directory.
   */
  root?: string;
  /**
   * Whether Vitest must be given `configFile` explicitly. False for a `vitest.config.*` or
   * `vite.config.*` in `root`: there Vitest's own choice is kept, as when the project runs `vitest`
   * in that directory, so a `vitest.config.ts` that merges the `vite.config.ts` with the plugin
   * still applies.
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

/**
 * Whether `file` registers the `storybookTest` plugin for the Storybook in `storybookDir`, read
 * from its source. A config inside the config dir is for that Storybook. Elsewhere, the plugin's
 * `configDir` option must name the config dir (its folder name, as a path segment), or be left out
 * for a config dir with the default name `.storybook`; so a config whose plugin runs another
 * Storybook of the same package (such as `.storybook-composition`) does not count.
 */
const registersStorybookPlugin = (file: string, storybookDir: string) => {
  let content: string;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  if (!content.includes('storybookTest') && !content.includes('@storybook/addon-vitest')) {
    return false;
  }
  if (dirname(file) === storybookDir) {
    return true;
  }
  const name = basename(storybookDir);
  if (!/\bconfigDir\b/.test(content)) {
    return name === '.storybook';
  }
  return new RegExp(`${escapeRegExp(name)}(?![\\w.-])`).test(content);
};

/** Config files in `directory`, the ones Vitest loads by itself first, in its order. */
const configFilesIn = (directory: string): string[] => {
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => CONFIG_FILE_PATTERN.test(name));
  } catch {
    return [];
  }
  const rank = (name: string) => {
    const index = DEFAULT_CONFIG_FILES.indexOf(name);
    return index === -1 ? DEFAULT_CONFIG_FILES.length : index;
  };
  return names
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((name) => join(directory, name));
};

/**
 * Finds the Vitest config that runs the stories of the Storybook in `configDir`: the nearest Vite
 * or Vitest config that registers the `storybookTest` plugin of `@storybook/addon-vitest` for that
 * Storybook.
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
  if (packageRoot === last || packageRoot.startsWith(`${last}/`)) {
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
  for (const directory of directories) {
    for (const file of configFilesIn(directory)) {
      if (!registersStorybookPlugin(file, storybookDir)) {
        others.push(file);
        continue;
      }
      const root = directory === storybookDir ? packageRoot : directory;
      const explicit = directory !== root || !DEFAULT_CONFIG_FILES.includes(basename(file));
      return {
        configFile: file,
        root,
        explicit,
        loads: explicit
          ? file
          : configFilesIn(root).find((f) => DEFAULT_CONFIG_FILES.includes(basename(f))),
        searched: directories,
        others,
      };
    }
  }

  return { searched: directories, others, explicit: false };
}
