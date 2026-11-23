import { describe, expect, it } from 'vitest';

import {
  builderPackages,
  frameworkPackages,
  frameworkToBuilder,
  rendererPackages,
} from 'storybook/internal/common';

import { allTemplates } from './sandbox-templates.ts';

describe.each(Object.entries(allTemplates))('sandbox template %s', (_key, { expected }) => {
  it('uses a framework the framework registry knows', () => {
    expect(frameworkPackages).toHaveProperty([expected.framework]);
  });

  it('uses the builder the framework registry gives its framework', () => {
    expect(builderPackages[expected.builder]).toBe(
      frameworkToBuilder[frameworkPackages[expected.framework]]
    );
  });

  it('uses a renderer the framework registry knows', () => {
    expect({ ...rendererPackages, ...frameworkPackages }).toHaveProperty([expected.renderer]);
  });
});
