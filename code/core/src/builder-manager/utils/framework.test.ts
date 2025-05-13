import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  pluckNameFromConfigProperty,
  pluckStorybookPackageFromPath,
  pluckThirdPartyPackageFromPath,
} from './framework';

describe('UTILITIES: Framework information', () => {
  describe('UTILITY: pluckNameFromConfigProperty', () => {
    it('should return undefined if the property is undefined', () => {
      expect(pluckNameFromConfigProperty(undefined)).toBe(undefined);
    });

    it('should return the name if the property is a string', () => {
      expect(pluckNameFromConfigProperty('foo')).toBe('foo');
    });

    it('should return the name if the property is an object', () => {
      expect(pluckNameFromConfigProperty({ name: 'foo' })).toBe('foo');
    });
  });

  describe('UTILITY: pluckStorybookPackageFromPath', () => {
    it('should return the package name if the path is a storybook package', () => {
      const packagePath = join(process.cwd(), 'node_modules', '@storybook', 'foo');
      expect(pluckStorybookPackageFromPath(packagePath)).toBe('@storybook/foo');
    });

    it('should return undefined if the path is not a storybook package', () => {
      const packagePath = join(process.cwd(), 'foo');
      expect(pluckStorybookPackageFromPath(packagePath)).toBe(undefined);
    });
  });

  describe('UTILITY: pluckThirdPartyPackageFromPath', () => {
    it('should return the package name if the path is a third party package', () => {
      const packagePath = join(process.cwd(), 'node_modules', 'bar');
      expect(pluckThirdPartyPackageFromPath(packagePath)).toBe('bar');
    });

    it('should return the given path if the path is not a third party package', () => {
      const packagePath = join(process.cwd(), 'foo', 'bar', 'baz');
      expect(pluckThirdPartyPackageFromPath(packagePath)).toBe(packagePath);
    });
  });
});
