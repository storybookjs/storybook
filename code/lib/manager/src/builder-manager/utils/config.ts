import { stringifyProcessEnvs } from '@storybook/core/internal/common';
import type { Options } from '@storybook/core/internal/types';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { resolveModulePath } from 'exsolve';
import { join } from 'pathe';

import { globalsModuleInfoMap } from '../../ui/globals/globals-module-info.ts';
import {
  BROWSER_TARGETS,
  SUPPORTED_FEATURES,
} from '@storybook/core/internal/deep/constants/environments-support';
import type { ManagerBuilder } from '../types.ts';
import { wrapManagerEntries } from './managerEntries.ts';
import { getTemplatePath } from './template.ts';

export async function getManagerConfig(
  options: Pick<Options, 'configDir' | 'outputDir' | 'cacheKey'>,
  entries: string[],
  envs: Record<string, string>
): Promise<Awaited<ReturnType<ManagerBuilder['getConfig']>>> {
  const tsconfigPath = getTemplatePath('addon.tsconfig.json');
  let configDirManagerEntry;
  try {
    configDirManagerEntry = resolveModulePath('./manager', {
      from: options.configDir,
      extensions: ['.js', '.mjs', '.jsx', '.ts', '.mts', '.tsx'],
    });
  } catch (e) {}

  const entryPoints = configDirManagerEntry ? [...entries, configDirManagerEntry] : entries;

  return {
    entryPoints: await wrapManagerEntries(entryPoints, options.cacheKey),
    outdir: join(options.outputDir || './', 'sb-addons'),
    format: 'iife',
    write: false,
    ignoreAnnotations: true,
    resolveExtensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
    outExtension: { '.js': '.js' },
    loader: {
      '.js': 'jsx',
      '.png': 'dataurl',
      '.gif': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
      '.webm': 'dataurl',
      '.mp3': 'dataurl',
      '.woff2': 'dataurl',
      '.woff': 'dataurl',
      '.eot': 'dataurl',
      '.ttf': 'dataurl',
    },
    target: BROWSER_TARGETS,
    supported: SUPPORTED_FEATURES,
    platform: 'browser',
    bundle: true,
    minify: false,
    minifyWhitespace: false,
    minifyIdentifiers: false,
    minifySyntax: true,
    metafile: false,

    sourcemap: false,
    conditions: ['browser', 'module', 'default'],

    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsx: 'transform',
    jsxImportSource: 'react',

    tsconfig: tsconfigPath,

    legalComments: 'external',
    plugins: [globalExternals(globalsModuleInfoMap)],

    banner: {
      js: 'try{',
    },
    footer: {
      js: '}catch(e){ console.error("[Storybook] One of your manager-entries failed: " + import.meta.url, e); }',
    },

    define: {
      'process.env': JSON.stringify(envs),
      ...stringifyProcessEnvs(envs),
      global: 'window',
      module: '{}',
    },
  };
}
