import {
  REACT_DOCGEN_FALLBACK_PACKAGE,
  hasTypeScriptCompilerApi,
  recordTemporaryDependency,
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

/**
 * TEMPORARY: delete this fix once Storybook supports TypeScript 7.1, which gives TypeScript 7
 * projects the docgen server. The TypeScript 7.1 automigration then removes the packages this fix
 * records under `storybook.temporaryDependencies`. See `typescript-7-react-docgen-fallback.ts` in
 * core.
 *
 * Storybook 10 installed `react-docgen` for every React project. Storybook 11 makes it an optional
 * peer, and a project on TypeScript 7.0 cannot use the docgen server, so without `react-docgen` it
 * would lose docgen on upgrade. Projects that set `features.docgenServer: false` are left alone:
 * they chose builder docgen and Storybook tells them to install `react-docgen` themselves.
 */
export const typescript7ReactDocgen: Fix<true> = {
  id: 'typescript-7-react-docgen',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check(options) {
    const { mainConfig, packageManager } = options;
    if (
      !upgradesAcrossPeerChange(options) ||
      getRendererName(mainConfig) !== SupportedRenderer.REACT
    ) {
      return null;
    }
    const features = mainConfig.features as
      | { docgenServer?: boolean; experimentalDocgenServer?: boolean }
      | undefined;
    const reactDocgen = (mainConfig.typescript as { reactDocgen?: unknown } | undefined)
      ?.reactDocgen;
    if (
      (features?.docgenServer ?? features?.experimentalDocgenServer) === false ||
      reactDocgen === false ||
      !packageManager.isDependencyInstalled('typescript') ||
      packageManager.isDependencyInstalled('react-docgen')
    ) {
      return null;
    }
    const version = coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
    return version && !hasTypeScriptCompilerApi(version) ? true : null;
  },

  prompt() {
    return `Your project uses TypeScript 7, which has no compiler API, so Storybook cannot use server-side docgen yet and falls back to ${picocolors.cyan('react-docgen')}, which Storybook no longer installs. Add it to devDependencies for now, so Controls and the Docs args table keep working? A later Storybook update removes it again once it supports TypeScript 7.1.`;
  },

  async run({ packageManager }) {
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      REACT_DOCGEN_FALLBACK_PACKAGE,
    ]);
    recordTemporaryDependency(packageManager, 'react-docgen');
  },
};
