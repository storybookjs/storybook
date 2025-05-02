import type { BuildOptions } from 'esbuild';
import type { Options } from 'tsup';

// https://esbuild.github.io/api/#target
// https://tsup.egoist.dev/#target-environment
export const BROWSER_TARGETS: Options['target'] = [
  'chrome131',
  'edge134',
  'firefox136',
  'safari18.3',
  'ios18.3',
  'opera117',
];

// https://esbuild.github.io/api/#target
// https://tsup.egoist.dev/#target-environment
export const NODE_TARGET: Options['target'] = 'node20';

// https://esbuild.github.io/api/#supported
export const SUPPORTED_FEATURES: BuildOptions['supported'] = {
  // React Native does not support class static blocks without a specific babel plugin
  'class-static-blocks': false,
};
