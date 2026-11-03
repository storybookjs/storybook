import {
  type BuilderDocgenPackage,
  type ReactDocgenOption,
  getBuilderDocgenPackageSpecifiers,
  getReactBuilderDocgenPackages,
  hasTypeScriptCompilerApi,
} from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { coerce } from 'semver';

import { getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { CheckOptions, Fix } from '../types.ts';

/** The release in which the React packages made the builder docgen packages optional peers. */
const introducedIn = '11.0.0';

const WEBPACK_FRAMEWORKS = ['@storybook/react-webpack5', '@storybook/nextjs'];
const VITE_FRAMEWORKS = [
  '@storybook/react-vite',
  '@storybook/nextjs-vite',
  '@storybook/react-native-web-vite',
  '@storybook/tanstack-react',
];

export interface BuilderDocgenPackagesResult {
  packages: BuilderDocgenPackage[];
  reactDocgen: Exclude<ReactDocgenOption, false>;
  /**
   * Why builder docgen runs: the main config sets `features.docgenServer: false`, or `typescript` is
   * TypeScript 7, which has no compiler API for the docgen server.
   */
  reason: 'docgen-server-disabled' | 'typescript-without-compiler-api';
}

const upgradesAcrossPeerChange = ({ beforeVersion, storybookVersion, requested }: CheckOptions) =>
  requested ||
  (!!beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn));

/**
 * Add the packages that the deprecated React builder docgen needs, now that Storybook no longer
 * installs them.
 *
 * Builder docgen runs when the main config sets `features.docgenServer: false`, or when
 * `typescript` is TypeScript 7. A project without `typescript` gets `typescript@^6` from the
 * `typescript-dependency` fix instead, which enables the docgen server.
 */
export const builderDocgenPackages: Fix<BuilderDocgenPackagesResult> = {
  id: 'builder-docgen-packages',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-react-docgen-and-react-docgen-typescript-are-optional-peer-dependencies',

  async check(options) {
    const { mainConfig, packageManager } = options;
    if (
      !upgradesAcrossPeerChange(options) ||
      getRendererName(mainConfig) !== SupportedRenderer.REACT
    ) {
      return null;
    }
    const framework = getFrameworkPackageName(mainConfig) ?? '';
    const builder = WEBPACK_FRAMEWORKS.includes(framework)
      ? 'webpack'
      : VITE_FRAMEWORKS.includes(framework)
        ? 'vite'
        : undefined;
    // `reactDocgen` is a React framework option, so the core main config type does not declare it.
    const reactDocgen =
      (mainConfig.typescript as { reactDocgen?: ReactDocgenOption } | undefined)?.reactDocgen ??
      'react-docgen';
    if (!builder || reactDocgen === false) {
      return null;
    }

    // Without a `typescript` dependency, the `typescript-dependency` fix adds `typescript@^6`,
    // which enables the docgen server, even when TypeScript 7 is installed transitively.
    if (!packageManager.isDependencyInstalled('typescript')) {
      return null;
    }
    const typescriptVersion = coerce(
      await packageManager.getDeclaredVersionSpecifier('typescript')
    )?.version;
    const typescriptWithoutCompilerApi =
      !!typescriptVersion && !hasTypeScriptCompilerApi(typescriptVersion);

    let reason: BuilderDocgenPackagesResult['reason'];
    // Every check runs before any fix applies, so `docgen-server` has not yet renamed the old flag.
    const features = mainConfig.features as
      | { docgenServer?: boolean; experimentalDocgenServer?: boolean }
      | undefined;
    if ((features?.docgenServer ?? features?.experimentalDocgenServer) === false) {
      reason = 'docgen-server-disabled';
    } else if (typescriptWithoutCompilerApi) {
      reason = 'typescript-without-compiler-api';
    } else {
      return null;
    }

    // react-docgen-typescript needs the compiler API too, so builder docgen uses react-docgen instead.
    const packages = getReactBuilderDocgenPackages(
      typescriptWithoutCompilerApi ? 'react-docgen' : reactDocgen,
      builder
    ).filter((name) => !packageManager.isDependencyInstalled(name));

    return packages.length > 0 ? { packages, reactDocgen, reason } : null;
  },

  prompt(result) {
    if (!result) {
      return 'Add the packages that the deprecated React builder docgen needs, which Storybook no longer installs';
    }
    const packages = result.packages.map((name) => picocolors.cyan(name)).join(' and ');
    if (result.reason === 'typescript-without-compiler-api') {
      return `Your project uses TypeScript 7, which has no compiler API, so Storybook falls back to the deprecated builder docgen with ${packages}. Storybook no longer installs it for you. Add it to devDependencies to keep Controls and the Docs args table working? Installing TypeScript 6 side by side (see the ${picocolors.cyan('typescript-compiler-api')} notice) enables server-side docgen, which does not need it.`;
    }
    return `Your main config sets ${picocolors.cyan('features.docgenServer: false')}, so Storybook keeps the deprecated builder docgen (${picocolors.cyan(`typescript.reactDocgen: '${result.reactDocgen}'`)}), which needs ${packages}. Storybook no longer installs these for you. Add them to devDependencies?`;
  },

  async run({ result, packageManager }) {
    await packageManager.addDependencies(
      { type: 'devDependencies', skipInstall: true },
      getBuilderDocgenPackageSpecifiers(result.packages)
    );
  },
};
