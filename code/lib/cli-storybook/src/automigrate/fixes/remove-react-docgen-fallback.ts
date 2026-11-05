import {
  TYPESCRIPT_7_DOCGEN_FALLBACK_REASON,
  getTemporaryDependenciesPath,
  isTypeScript71Stable,
  isTypeScriptUsableForDocgen,
  readTypeScriptPackageForDocgen,
  typeScriptDocgenApisFor,
} from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { coerce } from 'semver';

import type { Fix } from '../types.ts';

interface RemoveReactDocgenFallbackResult {
  recordPath: string;
  // The other temporary dependencies the record lists, which stay recorded.
  otherRecords: Record<string, string>;
}

// Storybook 11.0 added `react-docgen` to React projects on TypeScript 7.0, which has no API for the
// docgen server, and recorded that in the Storybook cache:
//
//     node_modules/.cache/storybook/temporary-dependencies.json
//     { "react-docgen": "typescript-7.0-docgen-fallback" }
//
// Once the TypeScript docgen loads is 5.9, 6, or 7.1 and newer, the docgen server runs and builder
// docgen does not, so this fix offers to remove `react-docgen` again. That is the package
// `typescript.docgenSpecifier` names when the main config sets it, and `typescript` otherwise. It skips projects whose main
// config sets `features.docgenServer: false`, which need `react-docgen`. Without the record (a fresh
// clone, CI, `npm ci`, a deleted `node_modules`) it keeps `react-docgen`: the user may have added
// it, and an unused devDependency is harmless.
export const removeReactDocgenFallback: Fix<RemoveReactDocgenFallbackResult> = {
  id: 'remove-react-docgen-fallback',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check({ packageManager, mainConfig, configDir, files }) {
    // TEMPORARY(ts-7.1): until TypeScript 7.1 is stable, `typescript-7-react-docgen` adds the
    // fallback instead.
    if (!isTypeScript71Stable()) {
      return null;
    }
    // The fallback added `react-docgen` to this package.json and recorded it next to it.
    const { packageJson, operationDir } = packageManager.primaryPackageJson;
    const recordPath = getTemporaryDependenciesPath(operationDir);
    let recorded: Record<string, string>;
    try {
      recorded = JSON.parse(await files.read(recordPath));
    } catch {
      return null;
    }
    const { 'react-docgen': reason, ...otherRecords } = recorded;
    if (
      reason !== TYPESCRIPT_7_DOCGEN_FALLBACK_REASON ||
      !packageJson.devDependencies?.['react-docgen']
    ) {
      return null;
    }
    const features = mainConfig.features as
      | { docgenServer?: boolean; experimentalDocgenServer?: boolean }
      | undefined;
    if ((features?.docgenServer ?? features?.experimentalDocgenServer) === false) {
      return null;
    }
    const apis = typeScriptDocgenApisFor(SupportedRenderer.REACT);
    const docgenSpecifier = (mainConfig.typescript as { docgenSpecifier?: string } | undefined)
      ?.docgenSpecifier;
    let version: string | undefined;
    if (docgenSpecifier) {
      if (!configDir) {
        return null;
      }
      try {
        ({ version } = readTypeScriptPackageForDocgen(
          { specifier: docgenSpecifier, configDir },
          apis
        ));
      } catch {
        return null;
      }
    } else {
      version = coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
    }
    return version && isTypeScriptUsableForDocgen(version, apis)
      ? { recordPath, otherRecords }
      : null;
  },

  prompt() {
    return `Storybook added ${picocolors.cyan('react-docgen')} to your project because server-side docgen could not run on TypeScript 7.0. Your TypeScript version is supported now, so Storybook no longer uses ${picocolors.cyan('react-docgen')}. Remove it from your devDependencies?`;
  },

  async run({ packageManager, result: { recordPath, otherRecords }, files }) {
    const { packageJson, operationDir } = packageManager.primaryPackageJson;
    const devDependencies = { ...packageJson.devDependencies };
    delete devDependencies['react-docgen'];
    packageJson.devDependencies = devDependencies;
    packageManager.writePackageJson(packageJson, operationDir);
    if (Object.keys(otherRecords).length > 0) {
      files.write(recordPath, JSON.stringify(otherRecords, null, 2));
    } else {
      files.remove(recordPath);
    }
  },
};
