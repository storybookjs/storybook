import { describe, expect, it } from 'vitest';

import { importPinned, resolvePin } from './pin.ts';

describe('resolvePin', () => {
  it('reports the package a pin actually installs, which an alias does not rename', () => {
    // The whole mechanism rests on this: `vue-component-meta-next` is an alias, so it resolves to a
    // second install of vue-component-meta at another version rather than to a package of its own.
    expect(resolvePin('vue-component-meta-next')).toMatchObject({ name: 'vue-component-meta' });
    expect(resolvePin('vue-component-meta')?.version).not.toBe(
      resolvePin('vue-component-meta-next')?.version
    );
  });

  it('answers undefined for an install that is not there', () => {
    expect(resolvePin('vue-component-meta-not-installed')).toBeUndefined();
  });

  it('resolves a package whose exports map hides its own package.json', () => {
    // vue-docgen-api is one, so asking for `<pkg>/package.json` throws and the walk-up path runs.
    expect(resolvePin('vue-docgen-api')).toMatchObject({ name: 'vue-docgen-api' });
  });
});

describe('importPinned', () => {
  it('refuses a pin that resolves to a different package', async () => {
    // Otherwise the run would measure vue-docgen-api under vue-component-meta's name.
    await expect(importPinned('vue-docgen-api', 'vue-component-meta')).rejects.toThrow(
      /resolves to "vue-docgen-api", not "vue-component-meta"/
    );
  });

  it('refuses a pin that resolves to nothing', async () => {
    await expect(importPinned('vue-component-meta-typo', 'vue-component-meta')).rejects.toThrow(
      /resolves to nothing/
    );
  });
});
