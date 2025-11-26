import type { PackageJson } from '../types';

const routerPackages = new Set([
  'react-router',
  'react-router-dom',
  'remix',
  '@tanstack/react-router',
  'expo-router',
  '@reach/router',
  'react-easy-router',
  '@remix-run/router',
  'wouter',
  'wouter-preact',
  'preact-router',
  'vue-router',
  'unplugin-vue-router',
  '@angular/router',
  '@solidjs/router',

  // metaframeworks that imply routing
  'next',
  'react-scripts',
  'gatsby',
  'nuxt',
  '@sveltejs/kit',
]);

/**
 * @param packageJson The package JSON of the project
 * @returns Boolean Does this project use a routing package?
 */
export function getHasRouterPackage(packageJson: PackageJson) {
  // NOTE: we just check real dependencies; if it is in dev dependencies, it may just be an example
  return Object.keys(packageJson?.dependencies ?? {}).some((depName) =>
    routerPackages.has(depName)
  );
}
