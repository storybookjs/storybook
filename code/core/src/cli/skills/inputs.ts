import { relative } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Options, StoriesEntry } from '../../types/index.ts';
import { extractFrameworkPackageName } from '../../common/utils/get-framework-name.ts';
import { findConfigFile } from '../../common/utils/get-storybook-info.ts';
import { normalizeStories } from '../../common/utils/normalize-stories.ts';
import { isCsfFactoryPreview, readConfig } from '../../csf-tools/ConfigFile.ts';

import { getRefsFromConfig } from '../../core-server/utils/get-refs-from-config.ts';
import { StoryIndexGenerator } from '../../core-server/utils/StoryIndexGenerator.ts';
import { getToolAvailability, type ToolAvailability } from './availability.ts';
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
  // `refs` compose other Storybooks, whose docs the MCP docs tools serve without local manifests.
  composed: boolean;
};

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

// `x{a,b/c}y` becomes `xay` and `xb/cy`.
function expandBraces(glob: string): string[] {
  const open = glob.indexOf('{');
  if (open === -1) {
    return [glob];
  }
  const alternatives: string[] = [];
  let start = open;
  let depth = 0;
  for (let i = open; i < glob.length; i++) {
    if (glob[i] === '{') {
      depth++;
    } else if (glob[i] === ',' && depth === 1) {
      alternatives.push(glob.slice(start + 1, i));
      start = i;
    } else if (glob[i] === '}' && --depth === 0) {
      alternatives.push(glob.slice(start + 1, i));
      return alternatives.flatMap((alternative) =>
        expandBraces(glob.slice(0, open) + alternative + glob.slice(i + 1))
      );
    }
  }
  return [glob];
}

// A character a glob class `[...]` or `[!...]` accepts.
function classCharacter(negated: string, body: string): string {
  if (!negated) {
    return body[0];
  }
  try {
    return [...'sxSX0'].find((character) => !new RegExp(`[${body}]`).test(character)) ?? 's';
  } catch {
    return 's';
  }
}

// Paths a glob could match, with each `*` filled by `svelte` so that a `.svelte` story can show
// up; a `?` stays, as the matcher accepts it as any character. The index's matcher checks each one, so a glob feature this does not handle can only
// miss a Svelte project, never report one.
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
      .replace(/\[([!^]?)([^\]]*)\]/g, (_, negated: string, body: string) =>
        classCharacter(negated, body)
      )
      .replaceAll('*', 'svelte')
  );
}

/**
 * The one probing path for skill-content assembly: everything the pure builders need, resolved
 * from the target Storybook's presets.
 */
export async function resolveSkillInputs(options: Options): Promise<SkillInputs> {
  const [availability, frameworkPreset, stories, preview, refs] = await Promise.all([
    getToolAvailability(options),
    options.presets.apply('framework'),
    options.presets.apply('stories', []),
    resolvePreview(options.configDir),
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
    composed: refs.length > 0,
  };
}
