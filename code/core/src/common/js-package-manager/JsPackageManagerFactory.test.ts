import { beforeEach, describe, expect, it } from 'vitest';

import { JsPackageManagerFactory } from './JsPackageManagerFactory';
import { NPMProxy } from './NPMProxy';
import { PNPMProxy } from './PNPMProxy';
import { Yarn1Proxy } from './Yarn1Proxy';
import { Yarn2Proxy } from './Yarn2Proxy';

describe('CLASS: JsPackageManagerFactory', () => {
  beforeEach(() => {
    JsPackageManagerFactory.clearCache();
  });

  describe('METHOD: getPackageManager', () => {
    describe('NPM proxy', () => {
      it('FORCE: it should return a NPM proxy when `force` option is `npm`', async () => {
        expect(await JsPackageManagerFactory.getPackageManager({ force: 'npm' })).toBeInstanceOf(
          NPMProxy
        );
      });
    });

    describe('PNPM proxy', () => {
      it('FORCE: it should return a PNPM proxy when `force` option is `pnpm`', async () => {
        expect(await JsPackageManagerFactory.getPackageManager({ force: 'pnpm' })).toBeInstanceOf(
          PNPMProxy
        );
      });
    });

    describe('Yarn 1 proxy', () => {
      it('FORCE: it should return a Yarn1 proxy when `force` option is `yarn1`', async () => {
        expect(await JsPackageManagerFactory.getPackageManager({ force: 'yarn1' })).toBeInstanceOf(
          Yarn1Proxy
        );
      });
    });

    describe('Yarn 2 proxy', () => {
      it('FORCE: it should return a Yarn2 proxy when `force` option is `yarn2`', async () => {
        expect(await JsPackageManagerFactory.getPackageManager({ force: 'yarn2' })).toBeInstanceOf(
          Yarn2Proxy
        );
      });
    });
  });
});
