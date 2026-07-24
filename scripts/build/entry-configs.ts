import a11yConfig from '../../code/addons/a11y/build-config.ts';
import docsConfig from '../../code/addons/docs/build-config.ts';
import linksConfig from '../../code/addons/links/build-config.ts';
import onboardingConfig from '../../code/addons/onboarding/build-config.ts';
import pseudoStatesConfig from '../../code/addons/pseudo-states/build-config.ts';
import themesConfig from '../../code/addons/themes/build-config.ts';
import vitestConfig from '../../code/addons/vitest/build-config.ts';
import builderViteConfig from '../../code/builders/builder-vite/build-config.ts';
import builderWebpack5Config from '../../code/builders/builder-webpack5/build-config.ts';
import storybookConfig from '../../code/core/build-config.ts';
import angularViteFrameworkConfig from '../../code/frameworks/angular-vite/build-config.ts';
import angularFrameworkConfig from '../../code/frameworks/angular/build-config.ts';
import emberFrameworkConfig from '../../code/frameworks/ember/build-config.ts';
import htmlViteFrameworkConfig from '../../code/frameworks/html-vite/build-config.ts';
import nextjsViteFrameworkConfig from '../../code/frameworks/nextjs-vite/build-config.ts';
import nextjsFrameworkConfig from '../../code/frameworks/nextjs/build-config.ts';
import preactViteFrameworkConfig from '../../code/frameworks/preact-vite/build-config.ts';
import reactNativeWebViteFrameworkConfig from '../../code/frameworks/react-native-web-vite/build-config.ts';
import reactViteFrameworkConfig from '../../code/frameworks/react-vite/build-config.ts';
import reactWebpack5FrameworkConfig from '../../code/frameworks/react-webpack5/build-config.ts';
import serverWebpack5FrameworkConfig from '../../code/frameworks/server-webpack5/build-config.ts';
import svelteViteFrameworkConfig from '../../code/frameworks/svelte-vite/build-config.ts';
import sveltekitFrameworkConfig from '../../code/frameworks/sveltekit/build-config.ts';
import vue3ViteFrameworkConfig from '../../code/frameworks/vue3-vite/build-config.ts';
import webComponentsViteFrameworkConfig from '../../code/frameworks/web-components-vite/build-config.ts';
import tanstackReactFrameworkConfig from '../../code/frameworks/tanstack-react/build-config.ts';
import cliConfig from '../../code/lib/cli-storybook/build-config.ts';
import codemodConfig from '../../code/lib/codemod/build-config.ts';
import coreWebpackConfig from '../../code/lib/core-webpack/build-config.ts';
import createStorybookConfig from '../../code/lib/create-storybook/build-config.ts';
import csfPluginConfig from '../../code/lib/csf-plugin/build-config.ts';
import docgenHarnessConfig from '../../code/lib/docgen-harness/build-config.ts';
import eslintPluginConfig from '../../code/lib/eslint-plugin/build-config.ts';
import mcpConfig from '../../code/lib/mcp/build-config.ts';
import reactDomShimConfig from '../../code/lib/react-dom-shim/build-config.ts';
import presetCraConfig from '../../code/presets/create-react-app/build-config.ts';
import presetReactWebpackConfig from '../../code/presets/react-webpack/build-config.ts';
import presetServerWebpackConfig from '../../code/presets/server-webpack/build-config.ts';
import htmlRendererConfig from '../../code/renderers/html/build-config.ts';
import preactRendererConfig from '../../code/renderers/preact/build-config.ts';
import reactRendererConfig from '../../code/renderers/react/build-config.ts';
import serverRendererConfig from '../../code/renderers/server/build-config.ts';
import svelteRendererConfig from '../../code/renderers/svelte/build-config.ts';
import vue3RendererConfig from '../../code/renderers/vue3/build-config.ts';
import webComponentsRendererConfig from '../../code/renderers/web-components/build-config.ts';
import type { BuildEntriesByPackageName } from './utils/entry-utils.ts';

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
  '@storybook/angular-vite': angularViteFrameworkConfig,
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
  '@storybook/tanstack-react': tanstackReactFrameworkConfig,

  // lib
  '@storybook/cli': cliConfig,
  '@storybook/codemod': codemodConfig,
  '@storybook/core-webpack': coreWebpackConfig,
  '@storybook/csf-plugin': csfPluginConfig,
  '@storybook/docgen-harness': docgenHarnessConfig,
  '@storybook/mcp': mcpConfig,
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
