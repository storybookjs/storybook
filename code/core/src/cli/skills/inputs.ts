import { relative } from 'node:path';

import * as pico from 'picomatch';

import type { Options, StoriesEntry } from '../../types/index.ts';
import { extractFrameworkPackageName } from '../../common/utils/get-framework-name.ts';
import { findConfigFile } from '../../common/utils/get-storybook-info.ts';
import { isCsfFactoryPreview, readConfig } from '../../csf-tools/ConfigFile.ts';

import { getRefsFromConfig } from '../../core-server/utils/get-refs-from-config.ts';
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
  /** A Svelte project whose `stories` globs match `.svelte` files, which Svelte CSF writes. */
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

// `{a,b/c}` becomes `a` and `b/c`, so a `/` inside braces does not cut the file name part.
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

// Only the file name part decides, so a glob that needs a folder (`*/*.stories.svelte`) counts.
function allowsSvelteFile(files: string): boolean {
  return expandBraces(files).some((glob) => {
    const name = glob.slice(glob.lastIndexOf('/') + 1);
    return pico.scan(name).isGlob
      ? pico.isMatch('Button.stories.svelte', name)
      : name.endsWith('.svelte');
  });
}

// A string without a glob is a directory, whose default files are not `.svelte`, or one file.
function matchesSvelteFiles(entry: StoriesEntry): boolean {
  if (typeof entry !== 'string') {
    return !!entry.files && allowsSvelteFile(entry.files);
  }
  const { isGlob, glob } = pico.scan(entry);
  return allowsSvelteFile(isGlob ? glob : entry);
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
    frameworkToRendererMap[framework] === '@storybook/svelte' && stories.some(matchesSvelteFiles);
  return {
    ...availability,
    ...preview,
    framework,
    svelteCsf,
    mcpToolsets,
    composed: refs.length > 0,
  };
}
