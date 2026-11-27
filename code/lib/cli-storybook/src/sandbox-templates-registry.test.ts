import { describe, expect, it } from 'vitest';

import {
  builderPackages,
  frameworkPackages,
  frameworkToBuilder,
  frameworkToRenderer,
  rendererPackages,
} from 'storybook/internal/common';

import { allTemplates } from './sandbox-templates.ts';

describe.each(Object.entries(allTemplates))('sandbox template %s', (_key, { expected }) => {
  it('uses the builder and renderer the framework registry gives its framework', () => {
    const framework = frameworkPackages[expected.framework];
    // Some templates name the framework package as their renderer
    const renderer =
      rendererPackages[expected.renderer] ??
      frameworkToRenderer[frameworkPackages[expected.renderer]];

    expect(framework).toBeDefined();
    expect({ builder: builderPackages[expected.builder], renderer }).toEqual({
      builder: frameworkToBuilder[framework],
      renderer: frameworkToRenderer[framework],
    });
  });
});
