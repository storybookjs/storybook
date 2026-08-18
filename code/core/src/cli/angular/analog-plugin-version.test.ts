import { expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ANALOG_VITE_PLUGIN_ANGULAR_VERSION } from './helpers.ts';

// `@storybook/angular-vite` needs `@analogjs/vite-plugin-angular` but cannot install its own peer,
// so both `storybook init` and the `angular-to-angular-vite` migration add it from the constant
// above. Tying that constant to the range the framework is developed against is what stops the CLI
// from installing a version the framework has never been built with.
it('installs the @analogjs/vite-plugin-angular range @storybook/angular-vite develops against', () => {
  const frameworkPackageJson = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../../frameworks/angular-vite/package.json'),
      'utf-8'
    )
  );

  expect(ANALOG_VITE_PLUGIN_ANGULAR_VERSION).toBe(
    frameworkPackageJson.devDependencies['@analogjs/vite-plugin-angular']
  );
});
