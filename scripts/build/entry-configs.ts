// @ts-ignore
import a11yConfig from '../../../code/addons/a11y/build-config';
// @ts-ignore
import docsConfig from '../../../code/addons/docs/build-config';
// @ts-ignore
import linksConfig from '../../../code/addons/links/build-config';
// @ts-ignore
import pseudoStatesConfig from '../../../code/addons/pseudo-states/build-config';
// @ts-ignore
import themesConfig from '../../../code/addons/themes/build-config';
// @ts-ignore
import vitestConfig from '../../../code/addons/vitest/build-config';
// @ts-ignore
import builderViteConfig from '../../../code/builders/builder-vite/build-config';
// @ts-ignore
import builderWebpack5Config from '../../../code/builders/builder-webpack5/build-config';
// @ts-ignore
import storybookConfig from '../../../code/core/build-config';
// @ts-ignore
import angularFrameworkConfig from '../../../code/frameworks/angular/build-config';
// @ts-ignore
import emberFrameworkConfig from '../../../code/frameworks/ember/build-config';
// @ts-ignore
import htmlViteFrameworkConfig from '../../../code/frameworks/html-vite/build-config';
// @ts-ignore
import nextjsViteFrameworkConfig from '../../../code/frameworks/nextjs-vite/build-config';
// @ts-ignore
import nextjsFrameworkConfig from '../../../code/frameworks/nextjs/build-config';
// @ts-ignore
import preactViteFrameworkConfig from '../../../code/frameworks/preact-vite/build-config';
// @ts-ignore
import reactNativeWebViteFrameworkConfig from '../../../code/frameworks/react-native-web-vite/build-config';
// @ts-ignore
import reactViteFrameworkConfig from '../../../code/frameworks/react-vite/build-config';
// @ts-ignore
import reactWebpack5FrameworkConfig from '../../../code/frameworks/react-webpack5/build-config';
// @ts-ignore
import serverWebpack5FrameworkConfig from '../../../code/frameworks/server-webpack5/build-config';
// @ts-ignore
import svelteViteFrameworkConfig from '../../../code/frameworks/svelte-vite/build-config';
// @ts-ignore
import sveltekitFrameworkConfig from '../../../code/frameworks/sveltekit/build-config';
// @ts-ignore
import vue3ViteFrameworkConfig from '../../../code/frameworks/vue3-vite/build-config';
// @ts-ignore
import webComponentsViteFrameworkConfig from '../../../code/frameworks/web-components-vite/build-config';
// @ts-ignore
import cliConfig from '../../../code/lib/cli-storybook/build-config';
// @ts-ignore
import codemodConfig from '../../../code/lib/codemod/build-config';
// @ts-ignore
import coreWebpackConfig from '../../../code/lib/core-webpack/build-config';
// @ts-ignore
import createStorybookConfig from '../../../code/lib/create-storybook/build-config';
// @ts-ignore
import csfPluginConfig from '../../../code/lib/csf-plugin/build-config';
// @ts-ignore
import eslintPluginConfig from '../../../code/lib/eslint-plugin/build-config';
// @ts-ignore
import reactDomShimConfig from '../../../code/lib/react-dom-shim/build-config';
// @ts-ignore
import presetCraConfig from '../../../code/presets/create-react-app/build-config';
// @ts-ignore
import presetReactWebpackConfig from '../../../code/presets/react-webpack/build-config';
// @ts-ignore
import presetServerWebpackConfig from '../../../code/presets/server-webpack/build-config';
// @ts-ignore
import htmlRendererConfig from '../../../code/renderers/html/build-config';
// @ts-ignore
import preactRendererConfig from '../../../code/renderers/preact/build-config';
// @ts-ignore
import reactRendererConfig from '../../../code/renderers/react/build-config';
// @ts-ignore
import serverRendererConfig from '../../../code/renderers/server/build-config';
// @ts-ignore
import svelteRendererConfig from '../../../code/renderers/svelte/build-config';
// @ts-ignore
import vue3RendererConfig from '../../../code/renderers/vue3/build-config';
// @ts-ignore
import webComponentsRendererConfig from '../../../code/renderers/web-components/build-config';
import type { BuildEntriesByPackageName } from './utils/entry-utils';

export const buildEntries = {
  storybook: storybookConfig,

  // addons
  '@storybook/addon-a11y': a11yConfig,
  '@storybook/addon-docs': docsConfig,
  '@storybook/addon-links': linksConfig,
  'storybook-addon-pseudo-states': pseudoStatesConfig,
  '@storybook/addon-themes': themesConfig,
  '@storybook/addon-vitest': vitestConfig,

  // builders
  '@storybook/builder-vite': builderViteConfig,
  '@storybook/builder-webpack5': builderWebpack5Config,

  // frameworks
  '@storybook/angular': angularFrameworkConfig,
  '@storybook/ember': emberFrameworkConfig,
  '@storybook/html-vite': htmlViteFrameworkConfig,
  '@storybook/nextjs': nextjsFrameworkConfig,
  '@storybook/nextjs-vite': nextjsViteFrameworkConfig,
  '@storybook/preact-vite': preactViteFrameworkConfig,
  '@storybook/react-native-web-vite': reactNativeWebViteFrameworkConfig,
  '@storybook/react-vite': reactViteFrameworkConfig,
  '@storybook/react-webpack5': reactWebpack5FrameworkConfig,
  '@storybook/server-webpack5': serverWebpack5FrameworkConfig,
  '@storybook/svelte-vite': svelteViteFrameworkConfig,
  '@storybook/sveltekit': sveltekitFrameworkConfig,
  '@storybook/vue3-vite': vue3ViteFrameworkConfig,
  '@storybook/web-components-vite': webComponentsViteFrameworkConfig,

  // lib
  '@storybook/cli': cliConfig,
  '@storybook/codemod': codemodConfig,
  '@storybook/core-webpack': coreWebpackConfig,
  '@storybook/csf-plugin': csfPluginConfig,
  '@storybook/react-dom-shim': reactDomShimConfig,
  'create-storybook': createStorybookConfig,
  'eslint-plugin-storybook': eslintPluginConfig,

  // presets
  '@storybook/preset-create-react-app': presetCraConfig,
  '@storybook/preset-react-webpack': presetReactWebpackConfig,
  '@storybook/preset-server-webpack': presetServerWebpackConfig,

  // renderers
  '@storybook/html': htmlRendererConfig,
  '@storybook/preact': preactRendererConfig,
  '@storybook/react': reactRendererConfig,
  '@storybook/server': serverRendererConfig,
  '@storybook/svelte': svelteRendererConfig,
  '@storybook/vue3': vue3RendererConfig,
  '@storybook/web-components': webComponentsRendererConfig,
};

export function isBuildEntries(key: string): key is keyof typeof buildEntries {
  return key in buildEntries;
}

export function hasPrebuild(
  entry: BuildEntriesByPackageName[keyof BuildEntriesByPackageName]
): entry is BuildEntriesByPackageName[keyof BuildEntriesByPackageName] & {
  prebuild: (cwd: string) => Promise<void>;
} {
  return 'prebuild' in entry;
}
