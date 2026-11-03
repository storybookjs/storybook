import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import {
  collectPackageDirs,
  isInPackageDirs,
  sharedModuleFile,
  sharedModuleName,
} from './shared-runtime-modules.ts';

const CORE_DIR = join(import.meta.dirname, '../../../code/core');

describe('sharedModuleFile', () => {
  it('names the entry after the specifier', () => {
    expect(sharedModuleName('chai')).toBe('chai');
    expect(sharedModuleName('@vitest/utils/error')).toBe('vitest-utils-error');
    expect(sharedModuleFile('preview', '@testing-library/jest-dom/matchers')).toBe(
      'preview/vendor/testing-library-jest-dom-matchers.js'
    );
  });
});

describe('collectPackageDirs', () => {
  it('collects the packages of the specifiers and their dependencies', () => {
    const names = collectPackageDirs(['@vitest/utils/error', 'chai'], CORE_DIR).map((dir) =>
      dir.split('/node_modules/').pop()
    );

    expect(names).toContain('@vitest/utils');
    expect(names).toContain('@vitest/pretty-format');
    expect(names).toContain('tinyrainbow');
    expect(names).toContain('chai');
    expect(new Set(names).size).toBe(names.length);
  });

  it('throws for a specifier that does not resolve', () => {
    expect(() => collectPackageDirs(['does-not-exist-anywhere'], CORE_DIR)).toThrow();
  });
});

describe('isInPackageDirs', () => {
  const isShared = isInPackageDirs(['/repo/node_modules/chai', '/repo/node_modules/@vitest/spy']);

  it('matches files inside the package directories', () => {
    expect(isShared('/repo/node_modules/chai/index.js')).toBe(true);
    expect(isShared('/repo/node_modules/@vitest/spy/dist/index.js?commonjs-proxy')).toBe(true);
  });

  it('does not match packages that only share a name prefix', () => {
    expect(isShared('/repo/node_modules/chai-as-promised/index.js')).toBe(false);
    expect(isShared('/repo/node_modules/@vitest/spy-extra/index.js')).toBe(false);
    expect(isShared('/repo/code/core/src/test/spy.ts')).toBe(false);
  });
});
