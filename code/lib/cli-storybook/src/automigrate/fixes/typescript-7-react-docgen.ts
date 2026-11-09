import {
  addReactDocgenFallback,
  isTypeScript71Stable,
  isTypeScriptUsableForDocgen,
  recommendedTypeScriptDocgenApis,
} from 'storybook/internal/common';
import { SupportedRenderer } from 'storybook/internal/types';

import picocolors from 'picocolors';

import { getDocgenTypeScriptVersion } from '../helpers/docgen-typescript.ts';
import { getRendererName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { upgradesAcrossPeerChange } from './typescript-dependency.ts';

/**
 * Storybook 10 installed `react-docgen` for every React project. Storybook 11 makes it an optional
 * peer, and a project on TypeScript 7.0 cannot use the docgen server, so without `react-docgen` it
 * would lose docgen on upgrade. Projects that set `features.docgenServer` are left alone: with
 * `false` they chose builder docgen and Storybook tells them to install `react-docgen` themselves,
 * and with `true` builder docgen never runs.
 */
export const typescript7ReactDocgen: Fix<true> = {
  id: 'typescript-7-react-docgen',
  link: 'https://storybook.js.org/docs/configure/integration/typescript#typescript-7',

  async check(options) {
    const { mainConfig, packageManager } = options;
    if (
      isTypeScript71Stable() ||
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
      (features?.docgenServer ?? features?.experimentalDocgenServer) !== undefined ||
      reactDocgen === false ||
      !packageManager.isDependencyInstalled('typescript') ||
      packageManager.isDependencyInstalled('react-docgen')
    ) {
      return null;
    }
    const docgenTypeScript = await getDocgenTypeScriptVersion(options);
    return docgenTypeScript &&
      !isTypeScriptUsableForDocgen(
        docgenTypeScript.version,
        recommendedTypeScriptDocgenApis(SupportedRenderer.REACT)
      )
      ? true
      : null;
  },

  prompt() {
    return `Until Storybook supports TypeScript 7.1, server-side docgen cannot read your component types on TypeScript 7.0 (see the ${picocolors.cyan('typescript-compiler-api')} notice). Storybook then falls back to the deprecated builder docgen with ${picocolors.cyan('react-docgen')}, which it no longer installs. Add ${picocolors.cyan('react-docgen')} for now, so Controls and the Docs args table keep working? Once your project is on TypeScript 7.1, you can remove it again.`;
  },

  async run({ packageManager }) {
    addReactDocgenFallback(packageManager);
  },
};
