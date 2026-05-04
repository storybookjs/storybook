/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content execute "yarn update"
 */
// configs
import csf from './configs/csf.ts';
import csfStrict from './configs/csf-strict.ts';
import addonInteractions from './configs/addon-interactions.ts';
import recommended from './configs/recommended.ts';
import flatCsf from './configs/flat/csf.ts';
import flatCsfStrict from './configs/flat/csf-strict.ts';
import flatAddonInteractions from './configs/flat/addon-interactions.ts';
import flatRecommended from './configs/flat/recommended.ts';

// rules
import awaitInteractions from './rules/await-interactions.ts';
import contextInPlayFunction from './rules/context-in-play-function.ts';
import csfComponent from './rules/csf-component.ts';
import defaultExports from './rules/default-exports.ts';
import hierarchySeparator from './rules/hierarchy-separator.ts';
import metaInlineProperties from './rules/meta-inline-properties.ts';
import metaSatisfiesType from './rules/meta-satisfies-type.ts';
import noRedundantStoryName from './rules/no-redundant-story-name.ts';
import noRendererPackages from './rules/no-renderer-packages.ts';
import noStoriesOf from './rules/no-stories-of.ts';
import noTitlePropertyInMeta from './rules/no-title-property-in-meta.ts';
import noUninstalledAddons from './rules/no-uninstalled-addons.ts';
import preferPascalCase from './rules/prefer-pascal-case.ts';
import storyExports from './rules/story-exports.ts';
import useStorybookExpect from './rules/use-storybook-expect.ts';
import useStorybookTestingLibrary from './rules/use-storybook-testing-library.ts';

export const configs = {
  // eslintrc configs
  csf: csf,
  'csf-strict': csfStrict,
  'addon-interactions': addonInteractions,
  recommended: recommended,

  // flat configs
  'flat/csf': flatCsf,
  'flat/csf-strict': flatCsfStrict,
  'flat/addon-interactions': flatAddonInteractions,
  'flat/recommended': flatRecommended,
};

export const rules = {
  'await-interactions': awaitInteractions,
  'context-in-play-function': contextInPlayFunction,
  'csf-component': csfComponent,
  'default-exports': defaultExports,
  'hierarchy-separator': hierarchySeparator,
  'meta-inline-properties': metaInlineProperties,
  'meta-satisfies-type': metaSatisfiesType,
  'no-redundant-story-name': noRedundantStoryName,
  'no-renderer-packages': noRendererPackages,
  'no-stories-of': noStoriesOf,
  'no-title-property-in-meta': noTitlePropertyInMeta,
  'no-uninstalled-addons': noUninstalledAddons,
  'prefer-pascal-case': preferPascalCase,
  'story-exports': storyExports,
  'use-storybook-expect': useStorybookExpect,
  'use-storybook-testing-library': useStorybookTestingLibrary,
};

export default {
  configs,
  rules,
};
