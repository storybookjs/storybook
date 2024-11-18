import { createRequire } from 'node:module';

// @ts-expect-error no types
import moduleAlias from 'module-alias';

import { getAlias as getNextImageAlias } from '../plugins/next-image/alias';
import { getAlias as getNextMocksAlias } from '../plugins/next-mocks/plugin';

const requirePackage = require || createRequire(import.meta.url);

moduleAlias.addAliases({
  react: 'next/dist/compiled/react',
  'react-dom/server': 'next/dist/compiled/react-dom/server.js',
  'react-dom/test-utils': requirePackage.resolve(
    'next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js'
  ),
  'react-dom': 'next/dist/compiled/react-dom',
  ...getNextMocksAlias('node'),
  ...getNextImageAlias('node'),
});
