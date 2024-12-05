import { join, relative } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import fg from 'fast-glob';
import type { KnipConfig } from 'knip';
import { match } from 'minimatch';

// Files we want to exclude from analysis should be negated project patterns, not `ignores`
// docs: https://knip.dev/guides/configuring-project-files
const project = [
  'src/**/*.{js,jsx,ts,tsx}',
  '!**/__search-files-tests__/**',
  '!**/__testfixtures__/**',
  '!**/__mocks-ng-workspace__/**',
  '!**/__mockdata__/**',
];

// Adding an explicit MDX "compiler", as the dependency knip looks for isn't listed (@mdx-js/mdx or astro)
// Alternatively, we could ignore a few false positives
// docs: https://knip.dev/features/compilers
const importMatcher = /import[^'"]+['"]([^'"]+)['"]/g;
const fencedCodeBlockMatcher = /```[\s\S]*?```/g;
const mdx = (text: string) =>
  [...text.replace(fencedCodeBlockMatcher, '').matchAll(importMatcher)].join('\n');

const baseConfig = {
  ignoreWorkspaces: ['renderers/svelte'], // ignored: Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in code/node_modules/@sveltejs/vite-plugin-svelte/package.json

  // storybook itself configured (only) in root
  storybook: { entry: ['**/*.@(mdx|stories.@(mdx|js|jsx|mjs|ts|tsx))'] },

  workspaces: {
    '.': {
      project,
    },
    'addons/*': {
      project,
    },
    'builders/*': {
      project,
    },
    core: {
      entry: ['src/index.ts', 'src/cli/bin/index.ts', 'src/*/{globals*,index,runtime}.ts'],
      project,
    },
    'frameworks/*': {
      entry: [
        // these extra entries we only need for frameworks/angular and frameworks/ember it seems
        'src/index.ts',
        'src/builders/{build,start}-storybook/index.ts',
        'src/**/docs/{index,config}.{js,ts}',
      ],
      project,
    },
    'lib/*': {
      project,
    },
    'presets/*': {
      project,
    },
    'renderers/*': {
      project,
    },
  },
  compilers: {
    mdx,
  },
} satisfies KnipConfig;

// Adds package.json#bundler.entries etc. to each workspace config `entry: []`
export const addBundlerEntries = async (config: KnipConfig) => {
  const baseDir = join(__dirname, '../code');
  const rootManifest = await import(join(baseDir, 'package.json'));
  const workspaceDirs = await fg(rootManifest.workspaces.packages, {
    cwd: baseDir,
    onlyDirectories: true,
  });
  const workspaceDirectories = workspaceDirs.map((dir) => relative(baseDir, join(baseDir, dir)));
  for (const wsDir of workspaceDirectories) {
    for (const configKey of Object.keys(baseConfig.workspaces)) {
      if (match([wsDir], configKey)) {
        const manifest = await import(join(baseDir, wsDir, 'package.json'));
        const configEntries = (config.workspaces[configKey].entry as string[]) ?? [];
        const bundler = manifest?.bundler;
        for (const value of Object.values(bundler ?? {})) {
          if (Array.isArray(value)) {
            configEntries.push(...value);
          }
        }
        config.workspaces[configKey].entry = Array.from(new Set(configEntries));
      }
    }
  }
  return config;
};

export default addBundlerEntries(baseConfig);
