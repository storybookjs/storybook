import { describe, it, expect } from 'vitest';
import { installableProjectTypes, SUPPORTED_RENDERERS } from './project_types';

describe('installableProjectTypes should have an entry for the supported framework', () => {
  SUPPORTED_RENDERERS.forEach((framework) => {
    it(`${framework}`, () => {
      expect(installableProjectTypes.includes(framework.replace(/-/g, '_'))).toBe(true);
    });
  });
});
