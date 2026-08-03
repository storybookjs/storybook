import { describe, expect, it } from 'vitest';

import { assertPin, pinOption } from './pin.ts';

describe('pinOption', () => {
  const schema = pinOption('vue-component-meta');

  it('defaults to the canonical package, so an unpinned run loads it', () => {
    expect(schema.parse(undefined)).toBe('vue-component-meta');
  });

  it('accepts an alias of the canonical package', () => {
    expect(schema.parse('vue-component-meta-next')).toBe('vue-component-meta-next');
  });

  it('rejects a specifier that is not the canonical package or an alias of it', () => {
    // Otherwise a typo would run the engine's name against a different package's numbers.
    expect(() => schema.parse('vue-docgen-api')).toThrow();
  });
});

describe('assertPin', () => {
  it('accepts the canonical package and an alias of it', () => {
    expect(assertPin('@compodoc/compodoc', '@compodoc/compodoc')).toBe('@compodoc/compodoc');
    expect(assertPin('@compodoc/compodoc', '@compodoc/compodoc-next')).toBe(
      '@compodoc/compodoc-next'
    );
  });

  it('rejects a pin naming a different package', () => {
    expect(() => assertPin('@compodoc/compodoc', 'vue-component-meta')).toThrow(/@compodoc/);
  });
});
