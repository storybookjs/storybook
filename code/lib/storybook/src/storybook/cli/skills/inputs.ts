import { relative } from 'node:path';

import type { Options } from '@storybook/core/internal/types';
import {
  extractFrameworkPackageName,
  getFrameworkNameFromConfig,
} from '@storybook/core/internal/common';
import { findConfigFile } from '@storybook/core/internal/common';
import { isCsfFactoryPreview, readConfig } from '@storybook/core/internal/csf-tools';

import { getToolAvailability, type ToolAvailability } from './availability.ts';
import { frameworkToRendererMap } from './content/framework-renderer.ts';

export type SkillInputs = ToolAvailability & {
  framework: string;
  renderer?: string;
  /** The preview file imports `definePreview`, the entry point of CSF Factories. */
  csfFactories: boolean;
  /** Path of the preview file relative to the working directory; a default name when there is none. */
  previewFile: string;
  /** The preview file, or `main` when there is none, is TypeScript. */
  typescript: boolean;
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
  const framework = extractFrameworkPackageName(getFrameworkNameFromConfig(frameworkPreset) ?? '');
  return { ...availability, ...preview, framework, renderer: frameworkToRendererMap[framework] };
}
