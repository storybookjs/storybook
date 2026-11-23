import { relative } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Options, StoriesEntry } from '../../types/index.ts';
import { extractFrameworkPackageName } from '../../common/utils/get-framework-name.ts';
import { findConfigFile } from '../../common/utils/get-storybook-info.ts';
import { normalizeStories } from '../../common/utils/normalize-stories.ts';
import { isCsfFactoryPreview, readConfig } from '../../csf-tools/ConfigFile.ts';

import { getRefsFromConfig } from '../../core-server/utils/get-refs-from-config.ts';
import { StoryIndexGenerator } from '../../core-server/utils/StoryIndexGenerator.ts';
import {
  ALL_MCP_TOOLSETS,
  getToolAvailability,
  type McpToolsets,
  type ToolAvailability,
} from './availability.ts';
import { frameworkToRendererMap } from './content/framework-renderer.ts';

export type SkillInputs = ToolAvailability & {
  framework: string;
  /** The preview file imports `definePreview`, the entry point of CSF Factories. */
  csfFactories: boolean;
  /** Path of the preview file relative to the working directory; a default name when there is none. */
  previewFile: string;
  /** A Svelte project whose stories are `.svelte` files, or whose `stories` entries would load one. */
  svelteCsf: boolean;
  /** The preview file, or `main` when there is none, is TypeScript. */
  typescript: boolean;
  // The toolsets of addon-mcp that `main.ts` turns on; all of them without addon-mcp.
  mcpToolsets: McpToolsets;
  // `refs` compose other Storybooks, whose docs the MCP docs tools serve without local manifests.
  composed: boolean;
};

// Reads the `mcpToolsets` preset property of addon-mcp, so `skills --mcp` names only the tools its
// server registers. An `X-MCP-Toolsets` request header replaces these toolsets for one client; the
// CLI cannot see that.
async function resolveMcpToolsets(options: Options): Promise<McpToolsets> {
  return (
    (await options.presets.apply<McpToolsets | undefined>('mcpToolsets', undefined)) ??
    ALL_MCP_TOOLSETS
  );
}

const isTypeScriptFile = (path: string) => /\.[cm]?tsx?$/.test(path);

async function resolvePreview(configDir = '.storybook') {
  const previewPath = findConfigFile('preview', configDir);
  const typescript = isTypeScriptFile(previewPath ?? findConfigFile('main', configDir) ?? '');
  const path = previewPath ?? `${configDir}/preview.${typescript ? 'ts' : 'js'}`;
  let csfFactories = false;
  if (previewPath) {
    try {
      csfFactories = isCsfFactoryPreview(await readConfig(previewPath));
    } catch {}
  }
  return {
    csfFactories,
    typescript,
    previewFile: relative(process.cwd(), path).replaceAll('\\', '/') || path,
  };
}

// Reads the story files on disk, as the index does, so a Svelte project whose stories are all `.ts`
// keeps the CSF text. Before the first story, it asks the index whether it would load a `.svelte` one.
async function writesSvelteCsf(stories: StoriesEntry[], configDir: string): Promise<boolean> {
  if (stories.length === 0) {
    return false;
  }
  const workingDir = process.cwd();
  const specifiers = normalizeStories(stories, { configDir, workingDir });
  let paths: string[] = [];
  try {
    const matches = await StoryIndexGenerator.findMatchingFilesForSpecifiers(
      specifiers,
      workingDir,
      true
    );
    paths = matches
      .flatMap(([, files]) => Object.keys(files))
      .filter((path) => !path.endsWith('.mdx'));
  } catch (error) {
    logger.debug(`Could not list story files for the write-stories skill: ${error}`);
  }
  if (paths.length > 0) {
    return paths.some((path) => path.endsWith('.svelte'));
  }
  return specifiers.some(({ directory, files, importPathMatcher }) =>
    [`${directory}/Example.stories.svelte`, ...examplePaths(`${directory}/${files}`)].some(
      (path) => path.endsWith('.svelte') && importPathMatcher.test(path)
    )
  );
}

// `{a,b/c}` becomes `a` and `b/c`.
function expandBraces(glob: string): string[] {
  const open = glob.indexOf('{');
  const commas: number[] = [];
  let depth = 0;
  for (let i = open; open !== -1 && i < glob.length; i++) {
    if (glob[i] === '{') {
      depth++;
    } else if (glob[i] === ',' && depth === 1) {
      commas.push(i);
    } else if (glob[i] === '}' && --depth === 0) {
      const bounds = [open, ...commas, i];
      return bounds
        .slice(1)
        .flatMap((end, n) =>
          expandBraces(glob.slice(0, open) + glob.slice(bounds[n] + 1, end) + glob.slice(i + 1))
        );
    }
  }
  return [glob];
}

// Paths a glob could match, with every wildcard filled by `svelte`, so that a `.svelte` story can
// show up; the index's matcher then decides whether it would load them.
function examplePaths(glob: string): string[] {
  let braced = glob.replace(/!\([^()]*\)/g, 'svelte');
  // Innermost groups first, so `@(mdx|stories.@(ts|svelte))` takes two passes.
  for (let previous = ''; previous !== braced;) {
    previous = braced;
    braced = braced.replace(
      /[@+?*]\(([^()]*)\)/g,
      (_, alternatives: string) => `{${alternatives.replaceAll('|', ',')}}`
    );
  }
  return expandBraces(braced).map((path) =>
    path
      .replaceAll('**/', '')
      .replaceAll('/**', '')
      .replace(/\[[!^]?(.)[^\]]*\]/g, (_, first: string) => first)
      .replaceAll('*', 'svelte')
      .replaceAll('?', 's')
  );
}

/**
 * The one probing path for skill-content assembly: everything the pure builders need, resolved
 * from the target Storybook's presets.
 */
export async function resolveSkillInputs(options: Options): Promise<SkillInputs> {
  const [availability, frameworkPreset, stories, preview, mcpToolsets, refs] = await Promise.all([
    getToolAvailability(options),
    options.presets.apply('framework'),
    options.presets.apply('stories', []),
    resolvePreview(options.configDir),
    resolveMcpToolsets(options),
    getRefsFromConfig(options),
  ]);
  const framework = extractFrameworkPackageName(
    typeof frameworkPreset === 'string' ? frameworkPreset : (frameworkPreset?.name ?? '')
  );
  const svelteCsf =
    frameworkToRendererMap[framework] === '@storybook/svelte' &&
    (await writesSvelteCsf(stories, options.configDir ?? '.storybook'));
  return {
    ...availability,
    ...preview,
    framework,
    svelteCsf,
    mcpToolsets,
    composed: refs.length > 0,
  };
}
