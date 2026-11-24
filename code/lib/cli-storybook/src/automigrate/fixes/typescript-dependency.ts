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

export const typescriptNativeApi: Fix<{ version: string; dependency: string }> = {
  id: 'typescript-native-api',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check(options) {
    const unusable = await getUnusableTypeScript(options);
    const dependency = unusable && getTypeScriptUpgradeForDocgen(unusable.apis);
    return dependency ? { version: unusable.version, dependency } : null;
  },

  prompt(result) {
    return `TypeScript ${result?.version ?? '7.0'} has no API that Storybook can use to read your component types for Controls and the Docs args table. TypeScript 7.1 and newer do. Upgrade to ${picocolors.cyan(result?.dependency ?? 'typescript@^7.1')}?`;
  },

  async run({ packageManager, result }) {
    packageManager.upgradeDeclaredDependency(result.dependency, result.version);
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
    return unusable && !getTypeScriptUpgradeForDocgen(unusable.apis)
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
