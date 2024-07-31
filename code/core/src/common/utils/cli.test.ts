import { describe, it, expect } from 'vitest';
import { isCorePackage } from './cli';

describe('UTILS', () => {
  describe.each([
    ['@storybook/react', true],
    ['@storybook/node-logger', true],
    ['@storybook/core', true],
    ['@storybook/linter-config', false],
    ['@storybook/design-system', false],
    ['@storybook/addon-styling', false],
    ['@storybook/addon-styling-webpack', false],
    ['@storybook/addon-webpack5-compiler-swc', false],
    ['@storybook/addon-webpack5-compiler-babel', false],
    ['@nx/storybook', false],
    ['@nrwl/storybook', false],
  ])('isCorePackage', (input, output) => {
    it(`It should return "${output}" when given "${input}"`, () => {
      expect(isCorePackage(input)).toEqual(output);
    });
  });
});
