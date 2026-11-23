import { relative } from 'node:path';

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
  /** A Svelte project whose `stories` entries find `.svelte` story files, which Svelte CSF writes. */
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

// Reads the story files on disk, as the index does, so every glob the index accepts works, and a
// Svelte project whose stories are all `.ts` keeps the CSF text.
async function hasSvelteStoryFiles(stories: StoriesEntry[], configDir: string): Promise<boolean> {
  try {
    const workingDir = process.cwd();
    const specifiers = normalizeStories(stories, { configDir, workingDir });
    const matches = await Promise.all(
      specifiers.map((specifier) =>
        StoryIndexGenerator.findMatchingFiles(specifier, workingDir, true)
      )
    );
    return matches.some((files) => Object.keys(files).some((path) => path.endsWith('.svelte')));
  } catch {
    return false;
  }
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
    (await hasSvelteStoryFiles(stories, options.configDir ?? '.storybook'));
  return {
    ...availability,
    ...preview,
    framework,
    svelteCsf,
    mcpToolsets,
    composed: refs.length > 0,
  };
}
