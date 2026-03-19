import { describe, expect, it } from 'vitest';

import { globToRegex, matchesPackagePattern } from './ecosystem-identifier';

describe('ecosystem-identifier', () => {
  describe('globToRegex', () => {
    it('should convert exact match patterns', () => {
      const regex = globToRegex('jest');
      expect(regex.test('jest')).toBe(true);
      expect(regex.test('jest-dom')).toBe(false);
      expect(regex.test('@jest/core')).toBe(false);
    });

    it('should convert wildcard patterns with *', () => {
      const regex = globToRegex('*playwright*');
      expect(regex.test('playwright')).toBe(true);
      expect(regex.test('@playwright/test')).toBe(true);
      expect(regex.test('some-playwright-package')).toBe(true);
      expect(regex.test('jest')).toBe(false);
    });

    it('should convert scoped package patterns', () => {
      const regex = globToRegex('@vitest/*');
      expect(regex.test('@vitest/ui')).toBe(true);
      expect(regex.test('@vitest/coverage-v8')).toBe(true);
      expect(regex.test('vitest')).toBe(false);
      expect(regex.test('@jest/vitest')).toBe(false);
    });

    it('should convert prefix wildcard patterns', () => {
      const regex = globToRegex('wdio*');
      expect(regex.test('wdio')).toBe(true);
      expect(regex.test('wdio-webdriverio')).toBe(true);
      expect(regex.test('webdriverio')).toBe(false);
    });

    it('should handle multiple wildcards', () => {
      const regex = globToRegex('*-router-*');
      expect(regex.test('react-router-dom')).toBe(true);
      expect(regex.test('vue-router-core')).toBe(true);
      expect(regex.test('router')).toBe(false);
      expect(regex.test('my-router')).toBe(false);
    });

    it('should escape special regex characters', () => {
      const regex = globToRegex('react-router');
      expect(regex.test('react-router')).toBe(true);
      expect(regex.test('react(router)')).toBe(false);
    });

    it('should handle path-like patterns', () => {
      const regex = globToRegex('*/router');
      expect(regex.test('@reach/router')).toBe(true);
      expect(regex.test('@remix-run/router')).toBe(true);
      expect(regex.test('router')).toBe(false);
      expect(regex.test('some/router')).toBe(true);
    });

    it('should handle complex patterns with multiple wildcards', () => {
      const regex = globToRegex('@tanstack/*-router');
      expect(regex.test('@tanstack/react-router')).toBe(true);
      expect(regex.test('@tanstack/vue-router')).toBe(true);
      expect(regex.test('@tanstack/router')).toBe(false);
      expect(regex.test('tanstack/react-router')).toBe(false);
    });
  });

  describe('matchesPackagePattern', () => {
    it('should return true when package matches any pattern', () => {
      const patterns = ['jest', 'vitest', '@testing-library/*'];
      expect(matchesPackagePattern('jest', patterns)).toBe(true);
      expect(matchesPackagePattern('vitest', patterns)).toBe(true);
      expect(matchesPackagePattern('@testing-library/react', patterns)).toBe(true);
    });

    it('should return false when package matches no patterns', () => {
      const patterns = ['jest', 'vitest', '@testing-library/*'];
      expect(matchesPackagePattern('cypress', patterns)).toBe(false);
      expect(matchesPackagePattern('mocha', patterns)).toBe(false);
    });

    it('should handle empty patterns array', () => {
      expect(matchesPackagePattern('any-package', [])).toBe(false);
    });

    it('should handle complex glob patterns', () => {
      const patterns = ['*playwright*', '@vitest/*', 'wdio*'];
      expect(matchesPackagePattern('playwright', patterns)).toBe(true);
      expect(matchesPackagePattern('@playwright/test', patterns)).toBe(true);
      expect(matchesPackagePattern('@vitest/ui', patterns)).toBe(true);
      expect(matchesPackagePattern('wdio', patterns)).toBe(true);
      expect(matchesPackagePattern('wdio-webdriverio', patterns)).toBe(true);
      expect(matchesPackagePattern('jest', patterns)).toBe(false);
    });
  });
});
