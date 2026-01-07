import type { PackageJson } from 'storybook/internal/types';

import { getActualPackageVersion } from './package-json';

type PackageGroupResult = Record<string, string | undefined>;

type AnalysisResult = {
  testPackages?: PackageGroupResult;
  stylingPackages?: PackageGroupResult;
  stateManagementPackages?: PackageGroupResult;
  dataFetchingPackages?: PackageGroupResult;
  uiLibraryPackages?: PackageGroupResult;
  i18nPackages?: PackageGroupResult;
  routerPackages?: PackageGroupResult;
};

const TEST_PACKAGES = [
  'playwright',
  'vitest',
  'jest',
  'cypress',
  'nightwatch',
  'webdriver',
  '@web/test-runner',
  'puppeteer',
  'karma',
  'jasmine',
  'chai',
  'testing-library',
  '@ngneat/spectator',
  'wdio',
  'msw',
  'miragejs',
  'sinon',
  'chromatic',
] as const;

const STYLING_PACKAGES = [
  // 71m
  'postcss',
  // 25,9m
  'tailwindcss',
  // 21,5m
  'autoprefixer',
  // 12m
  'sass',
  // 7,5m
  '@emotion/react',
  // 5,2m
  '@emotion/styled',
  // 4,4m
  'less',
  // 4m
  'styled-components',
  // 3m
  'bootstrap',
  // 2,5m
  'goober',
  // 1,4m
  'stylus',
  // 1,2m
  'jss',
  // 214k
  'linaria',
  // 117k
  'bulma',
  // 67k
  'aphrodite',
  // 65k
  'semantic-ui',
  // 49k
  'foundation-sites',
  // 28k
  'fela',
] as const;

const STATE_MANAGEMENT_PACKAGES = [
  // a million and above
  // 11m
  'redux',
  // 5,4m
  '@reduxjs/toolkit',
  // 8,3m
  'react-redux',
  // 10,8m
  'zustand',
  // 1,4m
  'jotai',
  // 322k
  'recoil',
  // 3m
  'mobx',
  // 1,3m
  'mobx-react-lite',
  // 658k
  'valtio',
  // 1,7m
  'xstate',
  // 900k
  '@xstate/react',
  // 22k
  'effector',
  // 10k
  'effector-react',
  // 17k
  'easy-peasy',
] as const;

const DATA_FETCHING_PACKAGES = [
  // 48m
  'axios',
  // 9,5m
  '@tanstack/react-query',
  // 8,2m
  'superagent',
  // 4,3m
  'swr',
  // 3,8m
  'isomorphic-fetch',
  // 3,6m
  'graphql-request',
  // 3,1m
  'ky',
  // 2,6m
  'relay-runtime',
  // 2,3m
  '@apollo/client',
  // 856k
  'react-query',
  // 285k
  'urql',
  // 109k (runtime is 2,6m)
  'react-relay',
] as const;

const UI_LIBRARY_PACKAGES = [
  // 4m
  '@mui/material',
  // 2,3m
  '@headlessui/react',
  // 1,4m
  'antd',
  // 800k
  'radix-ui',
  // 769k
  'react-bootstrap',
  // 640k
  '@mantine/core',
  // 616k
  '@chakra-ui/react',
  // 500k
  'shadcn',
  // 161k
  '@blueprintjs/core',
  // 143k
  'semantic-ui-react',
  // 143k
  'primereact',
  // 135k
  '@fluentui/react',
  // 82k
  'rsuite',
  // 55k
  '@carbon/react',
  // 28k
  'theme-ui',
  // 24k
  'rebass',
] as const;

const I18N_PACKAGES = [
  // 6,5m
  'i18next',
  // 4,4m
  'react-i18next',
  // 1,2m
  'react-intl',
  // 814k
  'next-intl',
  // 400k (+ 100k more on @lingui/react)
  '@lingui/core',
] as const;

const ROUTER_PACKAGES = [
  // 14m
  'react-router',
  // 12,3m
  'react-router-dom',
  // 8,3m
  'react-easy-router',
  // 6,2m
  '@remix-run/router',
  // 941k
  'expo-router',
  // 893k
  '@tanstack/react-router',
  // 751k
  'wouter',
  // 270k
  '@reach/router',
] as const;

export async function analyzeEcosystemPackages(packageJson: PackageJson): Promise<AnalysisResult> {
  const allDependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
    ...packageJson?.peerDependencies,
  };

  const depNames = Object.keys(allDependencies);

  const pickMatches = (packages: readonly string[]) =>
    // TODO: Discuss whether we want exact matches or `startsWith` or `includes`.
    // If we do startsWith we can grab more relevant packages but it can have false positives.
    // example: testing-library will match @testing-library/react, testing-library/jest-dom, etc.
    depNames.filter((dep) => packages.some((pkg) => dep === pkg));

  const pickDepsObject = (packages: readonly string[]) => {
    const result = Object.fromEntries(
      pickMatches(packages).map((dep) => [dep, allDependencies[dep]])
    );
    return Object.keys(result).length === 0 ? null : result;
  };

  const testPackagesResult = Object.fromEntries(
    await Promise.all(
      depNames
        // This doesn't use pickMatches because the previous behavior for test packages was simple includes but we should think about streamlining this.
        .filter((dep) => TEST_PACKAGES.some((pkg) => dep.includes(pkg)))
        .map(async (dep) => {
          // Only for test packages we resolve the version, for other packages we use the specifiers instead
          const resolved = await getActualPackageVersion(dep);
          return [dep, resolved?.version];
        })
    )
  );
  const testPackages = Object.keys(testPackagesResult).length === 0 ? null : testPackagesResult;

  const stylingPackages = pickDepsObject(STYLING_PACKAGES);
  const stateManagementPackages = pickDepsObject(STATE_MANAGEMENT_PACKAGES);
  const dataFetchingPackages = pickDepsObject(DATA_FETCHING_PACKAGES);
  const uiLibraryPackages = pickDepsObject(UI_LIBRARY_PACKAGES);
  const i18nPackages = pickDepsObject(I18N_PACKAGES);
  const routerPackages = pickDepsObject(ROUTER_PACKAGES);

  return {
    ...(testPackages && { testPackages: testPackages }),
    ...(stylingPackages && { stylingPackages: stylingPackages }),
    ...(stateManagementPackages && {
      stateManagementPackages: stateManagementPackages,
    }),
    ...(dataFetchingPackages && { dataFetchingPackages: dataFetchingPackages }),
    ...(uiLibraryPackages && { uiLibraryPackages: uiLibraryPackages }),
    ...(i18nPackages && { i18nPackages: i18nPackages }),
    ...(routerPackages && { routerPackages: routerPackages }),
  };
}
