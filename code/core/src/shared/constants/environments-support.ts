import type { BuildOptions } from 'esbuild';

// https://esbuild.github.io/api/#target
export const BROWSER_TARGETS: BuildOptions['target'] = [
  'chrome131',
  'edge134',
  'firefox136',
  'safari18.3',
  'ios18.3',
  'opera117',
];

// https://esbuild.github.io/api/#target
export const NODE_TARGET: BuildOptions['target'] = 'node20.19';

// https://esbuild.github.io/api/#supported
export const SUPPORTED_FEATURES: BuildOptions['supported'] = {
  // React Native does not support class static blocks without a specific babel plugin
  'class-static-blocks': false,
};
