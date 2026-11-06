import {
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  getTypeScriptUpgradeForDocgen,
  isTypeScriptUsableForDocgen,
  recommendedTypeScriptDocgenApis,
  typeScriptPackageForDocgen,
} from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import picocolors from 'picocolors';

import { getDocgenTypeScriptVersion } from '../helpers/docgen-typescript.ts';
import { getRendererName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { CheckOptions, Fix } from '../types.ts';

/** The release in which the docgen packages and `typescript` became peer dependencies. */
const introducedIn = '11.0.0';

export const upgradesAcrossPeerChange = ({
  beforeVersion,
  storybookVersion,
  requested,
}: CheckOptions) =>
  requested ||
  (!!beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn));

export const typescriptDependency: Fix<{ dependency: string }> = {
  id: 'typescript-dependency',
  link: 'https://storybook.js.org/docs/configure/integration/typescript',

  async check(options) {
    const { mainConfig, packageManager } = options;
    if (!upgradesAcrossPeerChange(options)) {
      return null;
    }
    const renderer = getRendererName(mainConfig);
    const needsTypeScript = !!renderer && RENDERERS_WITH_TYPESCRIPT_DOCGEN.includes(renderer);
    return needsTypeScript && !packageManager.isDependencyInstalled('typescript')
      ? { dependency: typeScriptPackageForDocgen(recommendedTypeScriptDocgenApis(renderer)) }
      : null;
  },

  prompt(result) {
    return `Add ${result?.dependency ?? 'TypeScript'} to devDependencies, so Storybook can read your component types for Controls and the Docs args table`;
  },

  async run({ packageManager, result }) {
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      result.dependency,
    ]);
  },
};

// The declared TypeScript version of a project whose docgen cannot run on it, with the APIs the
// renderer's docgen runs on, or `undefined`. A project whose main config sets
// `typescript.docgenSpecifier` is skipped: docgen does not load its `typescript` dependency, and
// docgen's own error names the specifier when that package is unusable.
const getUnusableTypeScript = async (options: CheckOptions) => {
  const renderer = getRendererName(options.mainConfig);
  if (
    !renderer ||
    ![...RENDERERS_WITH_TYPESCRIPT_DOCGEN, SupportedRenderer.ANGULAR].includes(renderer)
  ) {
    return undefined;
  }
  const docgenTypeScript = await getDocgenTypeScriptVersion(options);
  if (!docgenTypeScript || docgenTypeScript.specifier) {
    return undefined;
  }
  const { version } = docgenTypeScript;
  const apis = recommendedTypeScriptDocgenApis(renderer);
  return !isTypeScriptUsableForDocgen(version, apis) ? { version, apis } : undefined;
};

// Upgrade TypeScript 7.0 to 7.1 for docgen that runs on the native API, such as React's.
export const typescriptNativeApi: Fix<{
  version: string;
  dependency: string;
  type: 'dependencies' | 'devDependencies';
}> = {
  id: 'typescript-native-api',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check(options) {
    // Not gated on the release: projects already on Storybook 11.0 with TypeScript 7.0 need it too.
    const unusable = await getUnusableTypeScript(options);
    const upgrade =
      unusable &&
      getTypeScriptUpgradeForDocgen(
        unusable.apis,
        options.packageManager.primaryPackageJson.packageJson
      );
    return upgrade ? { version: unusable.version, ...upgrade } : null;
  },

  prompt(result) {
    return `TypeScript ${result?.version ?? '7.0'} has no API that Storybook can use to read your component types for Controls and the Docs args table. TypeScript 7.1 and newer do. Upgrade to ${picocolors.cyan(result?.dependency ?? 'typescript@^7.1')}?`;
  },

  async run({ packageManager, result }) {
    await packageManager.addDependencies({ type: result.type, skipInstall: true }, [
      result.dependency,
    ]);
  },
};

export const typescriptCompilerApi: Fix<{ version: string }> = {
  id: 'typescript-compiler-api',
  promptType: 'notification',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check(options) {
    if (!upgradesAcrossPeerChange(options)) {
      return null;
    }
    const unusable = await getUnusableTypeScript(options);
    // TEMPORARY(ts-7.1): `typescript-native-api` upgrades a project whose docgen runs on the native
    // API, once TypeScript 7.1 is stable.
    return unusable &&
      !getTypeScriptUpgradeForDocgen(
        unusable.apis,
        options.packageManager.primaryPackageJson.packageJson
      )
      ? { version: unusable.version }
      : null;
  },

  // The upgrade prints the full prompt only when it differs from the one-line hint without a result.
  prompt(result) {
    if (!result) {
      return 'TypeScript 7 has no compiler API, so Storybook cannot read your component types. Install TypeScript 6 side by side.';
    }
    const native = `"@typescript/native": "npm:typescript@^${result.version}"`;
    const typescript = `"typescript": "npm:@typescript/typescript6@^6.0.2"`;
    return `TypeScript 7 has no compiler API, so Storybook cannot read your component types. In package.json, replace the ${picocolors.cyan('typescript')} devDependency with ${picocolors.cyan(native)} and ${picocolors.cyan(typescript)}. This is not automigrated.`;
  },
};
