import {
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  isTypeScriptUsableForDocgen,
  typeScriptDocgenApisFor,
  typeScriptPackageForDocgen,
} from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { coerce } from 'semver';

import { getRendererName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { CheckOptions, Fix } from '../types.ts';

const introducedIn = '11.0.0';

const upgradesAcrossPeerChange = ({ beforeVersion, storybookVersion, requested }: CheckOptions) =>
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
      ? { dependency: typeScriptPackageForDocgen(typeScriptDocgenApisFor(renderer)) }
      : null;
  },

  prompt(result) {
    return `Add ${result?.dependency ?? typeScriptPackageForDocgen()} to devDependencies, so Storybook can read your component types for Controls and the Docs args table`;
  },

  async run({ packageManager, result }) {
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      result.dependency,
    ]);
  },
};

export const typescriptCompilerApi: Fix<{ version: string; nativeApiSupported: boolean }> = {
  id: 'typescript-compiler-api',
  promptType: 'notification',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check(options) {
    const { mainConfig, packageManager } = options;
    if (!upgradesAcrossPeerChange(options)) {
      return null;
    }
    const renderer = getRendererName(mainConfig);
    if (
      !renderer ||
      ![...RENDERERS_WITH_TYPESCRIPT_DOCGEN, SupportedRenderer.ANGULAR].includes(renderer)
    ) {
      return null;
    }
    const version = coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
    if (!version) {
      return null;
    }
    const apis = typeScriptDocgenApisFor(renderer);
    return isTypeScriptUsableForDocgen(version, apis)
      ? null
      : { version, nativeApiSupported: apis.includes('native') };
  },

  // The upgrade prints the full prompt only when it differs from the one-line hint without a result.
  prompt(result) {
    if (!result) {
      return 'TypeScript 7 has no compiler API, so Storybook cannot read your component types. Install TypeScript 6 side by side.';
    }
    if (result.nativeApiSupported) {
      return `TypeScript 7.0 has no API that Storybook can use to read your component types. Upgrade to ${picocolors.cyan('typescript@^7.1')}. This is not automigrated.`;
    }
    const native = `"@typescript/native": "npm:typescript@^${result.version}"`;
    const typescript = `"typescript": "npm:@typescript/typescript6@^6.0.2"`;
    return `TypeScript 7 has no compiler API, so Storybook cannot read your component types. In package.json, replace the ${picocolors.cyan('typescript')} devDependency with ${picocolors.cyan(native)} and ${picocolors.cyan(typescript)}. This is not automigrated.`;
  },
};
