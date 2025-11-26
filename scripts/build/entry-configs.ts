// @ts-ignore
import a11yConfig from '../../addons/a11y/build-config';
// @ts-ignore
import docsConfig from '../../addons/docs/build-config';
// @ts-ignore
import linksConfig from '../../addons/links/build-config';
// @ts-ignore
import onboardingConfig from '../../addons/onboarding/build-config';
// @ts-ignore
import pseudoStatesConfig from '../../addons/pseudo-states/build-config';
// @ts-ignore
import themesConfig from '../../addons/themes/build-config';
// @ts-ignore
import vitestConfig from '../../addons/vitest/build-config';
// @ts-ignore
import builderViteConfig from '../../builders/builder-vite/build-config';
// @ts-ignore
import builderWebpack5Config from '../../builders/builder-webpack5/build-config';
// @ts-ignore
import storybookConfig from '../../core/build-config';
// @ts-ignore
import angularFrameworkConfig from '../../frameworks/angular/build-config';
// @ts-ignore
import emberFrameworkConfig from '../../frameworks/ember/build-config';
// @ts-ignore
import htmlViteFrameworkConfig from '../../frameworks/html-vite/build-config';
// @ts-ignore
import nextjsViteFrameworkConfig from '../../frameworks/nextjs-vite/build-config';
// @ts-ignore
import nextjsFrameworkConfig from '../../frameworks/nextjs/build-config';
// @ts-ignore
import preactViteFrameworkConfig from '../../frameworks/preact-vite/build-config';
// @ts-ignore
import reactNativeWebViteFrameworkConfig from '../../frameworks/react-native-web-vite/build-config';
// @ts-ignore
import reactViteFrameworkConfig from '../../frameworks/react-vite/build-config';
// @ts-ignore
import reactWebpack5FrameworkConfig from '../../frameworks/react-webpack5/build-config';
// @ts-ignore
import serverWebpack5FrameworkConfig from '../../frameworks/server-webpack5/build-config';
// @ts-ignore
import svelteViteFrameworkConfig from '../../frameworks/svelte-vite/build-config';
// @ts-ignore
import sveltekitFrameworkConfig from '../../frameworks/sveltekit/build-config';
// @ts-ignore
import vue3ViteFrameworkConfig from '../../frameworks/vue3-vite/build-config';
// @ts-ignore
import webComponentsViteFrameworkConfig from '../../frameworks/web-components-vite/build-config';
// @ts-ignore
import cliConfig from '../../lib/cli-storybook/build-config';
// @ts-ignore
import codemodConfig from '../../lib/codemod/build-config';
// @ts-ignore
import coreWebpackConfig from '../../lib/core-webpack/build-config';
// @ts-ignore
import createStorybookConfig from '../../lib/create-storybook/build-config';
// @ts-ignore
import csfPluginConfig from '../../lib/csf-plugin/build-config';
// @ts-ignore
import eslintPluginConfig from '../../lib/eslint-plugin/build-config';
// @ts-ignore
import reactDomShimConfig from '../../lib/react-dom-shim/build-config';
// @ts-ignore
import presetCraConfig from '../../presets/create-react-app/build-config';
// @ts-ignore
import presetReactWebpackConfig from '../../presets/react-webpack/build-config';
// @ts-ignore
import presetServerWebpackConfig from '../../presets/server-webpack/build-config';
// @ts-ignore
import htmlRendererConfig from '../../renderers/html/build-config';
// @ts-ignore
import preactRendererConfig from '../../renderers/preact/build-config';
// @ts-ignore
import reactRendererConfig from '../../renderers/react/build-config';
// @ts-ignore
import serverRendererConfig from '../../renderers/server/build-config';
// @ts-ignore
import svelteRendererConfig from '../../renderers/svelte/build-config';
// @ts-ignore
import vue3RendererConfig from '../../renderers/vue3/build-config';
// @ts-ignore
import webComponentsRendererConfig from '../../renderers/web-components/build-config';
import type { BuildEntriesByPackageName } from './utils/entry-utils';

export const buildEntries = {
  storybook: storybookConfig,

  // addons
  '@storybook/addon-a11y': a11yConfig,
  '@storybook/addon-docs': docsConfig,
  '@storybook/addon-links': linksConfig,
  '@storybook/addon-onboarding': onboardingConfig,
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
