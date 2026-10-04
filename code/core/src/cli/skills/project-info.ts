import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import { cache, getPrettyPackageManagerName } from 'storybook/internal/common';
import type { SupportedRenderer } from 'storybook/internal/types';
import { SupportedLanguage } from 'storybook/internal/types';

import { detectLanguage } from '../detectLanguage.ts';
import { getStorybookData } from '../getStorybookData.ts';
import { getMonorepoType, type MonorepoType } from '../../shared/utils/get-monorepo-type.ts';

export interface ProjectInfo {
  storybookVersion: string | undefined;
  majorVersion: number | undefined;
  framework: string | null;
  /** The full renderer package name, e.g. "@storybook/react" */
  rendererPackage: string | null;
  /** The short renderer name for docs URLs, e.g. "react" */
  renderer?: SupportedRenderer;
  builderPackage: string | null;
  addons: string[];
  configDir: string;
  storiesPaths: string[];
  /** Whether the project uses TypeScript ('ts') or JavaScript ('js'), inferred from the main config file extension. */
  language: 'ts' | 'js';
  /** Detected package manager (npm, yarn, pnpm, bun), if known. */
  packageManager: JsPackageManager;
  /** Pretty name of the detected package manager, if known. */
  packageManagerName?: string;
  /** Whether the project's preview file uses the CSF Factory format. */
  hasCsfFactoryPreview: boolean;
  /** Whether the user has requested to be onboarded into Storybook. */
  needsUserOnboarding: boolean;
  /** The monorepo tool detected at the project root, if any. */
  monorepoType: MonorepoType;
}

export type ProjectInfoResult =
  | { ok: true; projectInfo: ProjectInfo }
  | { ok: false; message: string };

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

// Returns a discriminated result instead of throwing so callers (the `ai setup` CLI and
// `skills setup`) render their own failure message instead of duplicating logging.
export async function getProjectInfo(opts: {
  configDir?: string;
  packageManager?: PackageManagerName;
}): Promise<ProjectInfoResult> {
  try {
    const data = await getStorybookData({
      configDir: opts.configDir,
      packageManagerName: opts.packageManager,
    });

    if (!data.frameworkPackage || !data.rendererPackage || !data.builderPackage) {
      return {
        ok: false,
        message:
          'Could not detect framework, renderer, or builder from your Storybook config. Make sure you are running this command from your project root, or specify --config-dir.',
      };
    }

    const majorVersion = data.versionInstalled
      ? parseMajorVersion(data.versionInstalled)
      : undefined;

    const detectedLanguage = await detectLanguage(data.packageManager, data.workingDir);
    const language = detectedLanguage === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';

    const needsUserOnboarding = await cache.get<boolean>('onboarding-pending', false);

    const projectInfo: ProjectInfo = {
      storybookVersion: data.versionInstalled,
      majorVersion,
      framework: data.frameworkPackage,
      rendererPackage: data.rendererPackage,
      renderer: data.renderer,
      builderPackage: data.builderPackage,
      addons: data.addons ?? [],
      configDir: data.configDir,
      storiesPaths: data.storiesPaths,
      packageManager: data.packageManager,
      packageManagerName: getPrettyPackageManagerName(data.packageManager.type),
      language,
      hasCsfFactoryPreview: data.hasCsfFactoryPreview,
      needsUserOnboarding,
      monorepoType: getMonorepoType(),
    };

    return { ok: true, projectInfo };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to read Storybook configuration: ${err instanceof Error ? err.message : String(err)}\nMake sure you are running this command from your project root, or specify --config-dir.`,
    };
  }
}
