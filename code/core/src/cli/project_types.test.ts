import { describe, expect, it } from 'vitest';

import { SUPPORTED_RENDERERS, installableProjectTypes } from './project_types';

describe('installableProjectTypes should have an entry for the supported framework', () => {
  SUPPORTED_RENDERERS.forEach((framework) => {
    it(`${framework}`, () => {
      expect(installableProjectTypes.includes(framework.replace(/-/g, '_'))).toBe(true);
    });
  });
});
