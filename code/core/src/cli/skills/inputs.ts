import { relative } from 'node:path';

import type { Options } from '../../types/index.ts';
import { extractFrameworkPackageName } from '../../common/utils/get-framework-name.ts';
import { findConfigFile } from '../../common/utils/get-storybook-info.ts';
import { isCsfFactoryPreview, readConfig } from '../../csf-tools/ConfigFile.ts';

import { getToolAvailability, type ToolAvailability } from './availability.ts';
import { frameworkToRendererMap } from './content/framework-renderer.ts';

export type SkillInputs = ToolAvailability & {
  framework: string;
  renderer?: string;
  /** The preview file imports `definePreview`, the entry point of CSF Factories. */
  csfFactories: boolean;
  /** Path of the preview file relative to the working directory; a default name when there is none. */
  previewFile: string;
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
    } catch {
      // An unparsable preview is treated as a non-factory one.
    }
  }
  return {
    csfFactories,
    previewFile: relative(process.cwd(), path).replaceAll('\\', '/') || path,
  };
}

/**
 * The one probing path for skill-content assembly: everything the pure builders need, resolved
 * from the target Storybook's presets. Both the skills CLI and addon-mcp fill builder inputs from
 * this, so the two channels cannot drift.
 */
export async function resolveSkillInputs(options: Options): Promise<SkillInputs> {
  const [availability, frameworkPreset, preview] = await Promise.all([
    getToolAvailability(options),
    options.presets.apply('framework'),
    resolvePreview(options.configDir),
  ]);
  const framework = extractFrameworkPackageName(
    typeof frameworkPreset === 'string' ? frameworkPreset : (frameworkPreset?.name ?? '')
  );
  return { ...availability, ...preview, framework, renderer: frameworkToRendererMap[framework] };
}
