export const TEST_PACKAGES = [
  '*playwright*',
  '@playwright/*',
  '*vitest*',
  '@vitest/*',
  'jest',
  'cypress',
  'nightwatch',
  'webdriver',
  '@web/test-runner',
  'puppeteer',
  'karma',
  'jasmine',
  'chai',
  '@testing-library/*',
  '@ngneat/spectator',
  'wdio*',
  'msw',
  'miragejs',
  'sinon',
  'chromatic',
  '@chromatic-com/*',
] as const;

export const STYLING_PACKAGES = [
  'postcss',
  'tailwindcss',
  'autoprefixer',
  'sass',
  'emotion',
  '@emotion/*',
  'less',
  'styled-components',
  '@stylexjs/*',
  'bootstrap',
  'goober',
  'stylus',
  'jss',
  'linaria',
  'bulma',
  'aphrodite',
  'semantic-ui',
  'foundation-sites',
  'fela',
] as const;

export const STATE_MANAGEMENT_PACKAGES = [
  '*redux*',
  '@reduxjs/*',
  'zustand',
  'jotai',
  'recoil',
  'mobx*',
  'valtio',
  'xstate',
  '@xstate/*',
  'effector',
  'effector-react',
  'easy-peasy',
] as const;

export const DATA_FETCHING_PACKAGES = [
  'axios',
  '@tanstack/react-query',
  'superagent',
  'swr',
  'isomorphic-fetch',
  '*graphql*',
  'ky',
  '@apollo/*',
  'relay-runtime',
  'react-query',
  'urql',
  'react-relay',
] as const;

export const UI_LIBRARY_PACKAGES = [
  '@mui/*',
  '@headlessui/*',
  'antd',
  'radix-ui',
  '@radix-ui/*',
  'react-bootstrap',
  '@mantine/*',
  '@chakra-ui/*',
  'shadcn',
  '@blueprintjs/*',
  'semantic-ui-react',
  'primereact',
  '@fluentui/*',
  'rsuite',
  'react-aria*',
  '@react-aria/*',
  '@heroui/*',
  '@carbon/*',
  'theme-ui',
  'rebass',
] as const;

export const I18N_PACKAGES = ['*i18n*', '*intl', '@lingui/*'] as const;

export const ROUTER_PACKAGES = [
  'react-router',
  'react-router-dom',
  'react-easy-router',
  '@remix-run/router',
  'expo-router',
  '@tanstack/*-router',
  'wouter',
  '@reach/router',
] as const;

// Bundlers and their direct tooling. Storybook's own builder packages are reported separately
// (as storybookPackages), so patterns here stay exact or scoped to avoid re-matching them.
export const BUNDLER_PACKAGES = [
  'webpack',
  'webpack-cli',
  'webpack-dev-server',
  'vite',
  'rolldown',
  'rolldown-vite',
  'esbuild',
  'parcel',
  '@parcel/*',
  '@rspack/*',
  '@rsbuild/*',
] as const;

export function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace * with .* to match any sequence of characters
  const regexPattern = escaped.replace(/\*/g, '.*');
  // Anchor the pattern to match the entire string
  return new RegExp(`^${regexPattern}$`);
}

export function matchesPackagePattern(
  dependencyName: string,
  patterns: readonly string[]
): boolean {
  return patterns.some((pattern) => globToRegex(pattern).test(dependencyName));
}

export function isStateManagementPackage(dependencyName: string): boolean {
  return matchesPackagePattern(dependencyName, STATE_MANAGEMENT_PACKAGES);
}

export function isStylingPackage(dependencyName: string): boolean {
  return matchesPackagePattern(dependencyName, STYLING_PACKAGES);
}

export function isRouterPackage(dependencyName: string): boolean {
  return matchesPackagePattern(dependencyName, ROUTER_PACKAGES);
}

export function isI18nPackage(dependencyName: string): boolean {
  return matchesPackagePattern(dependencyName, I18N_PACKAGES);
}
