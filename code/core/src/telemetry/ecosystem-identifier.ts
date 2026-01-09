import picomatch from 'picomatch';

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
] as const;

export const STYLING_PACKAGES = [
  'postcss',
  'tailwindcss',
  'autoprefixer',
  'sass',
  '@emotion/*',
  'less',
  'styled-components',
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
  // e.g. react-router, react-easy-router
  '*-router',
  // e.g. react-router-dom
  '*-router-*',
  // e.g. @reach/router, @remix-run/router
  '*/router',
  '@tanstack/*-router',
  'wouter',
] as const;

export function matchesPackagePattern(
  dependencyName: string,
  patterns: readonly string[]
): boolean {
  return patterns.some((pattern) => picomatch.isMatch(dependencyName, pattern));
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
