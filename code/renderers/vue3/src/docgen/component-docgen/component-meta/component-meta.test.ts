import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { TypeMeta, type ComponentMeta } from 'vue-component-meta';

import { applyVueDocgenApiTempFixes } from './component-meta.ts';

/**
 * Minimal meta: the fallback merge only reads and appends slots, so the other sections stay
 * empty. `parseMulti` runs against the SFCs in `__testfixtures__`, so the merge is exercised
 * with real vue-docgen-api output rather than hand-built slot descriptors.
 */
const metaWithoutSlots = (): ComponentMeta =>
  ({
    type: TypeMeta.Unknown,
    props: [],
    events: [],
    slots: [],
    exposed: [],
  }) as unknown as ComponentMeta;

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`./__testfixtures__/${name}`, import.meta.url));

describe('applyVueDocgenApiTempFixes template slots', () => {
  it('should fold a dynamic outlet with a literal fallback to that fallback name', async () => {
    const [meta] = await applyVueDocgenApiTempFixes(
      fixturePath('dynamic-slot-fallback.vue'),
      [metaWithoutSlots()],
      ['default']
    );

    expect(meta?.slots).toEqual([
      expect.objectContaining({ name: 'default', type: '{}', schema: '{}' }),
    ]);
  });

  it('should drop a dynamic outlet whose name cannot be resolved', async () => {
    const [meta] = await applyVueDocgenApiTempFixes(
      fixturePath('dynamic-slot-bare.vue'),
      [metaWithoutSlots()],
      ['default']
    );

    expect(meta?.slots).toEqual([]);
  });

  it('should pass static slot names through unchanged, bindings included', async () => {
    const [meta] = await applyVueDocgenApiTempFixes(
      fixturePath('static-slots.vue'),
      [metaWithoutSlots()],
      ['default']
    );

    expect(meta?.slots).toEqual([
      expect.objectContaining({ name: 'item-row', type: '{ item: unknown }' }),
      expect.objectContaining({ name: 'default', type: '{}' }),
    ]);
  });

  it('should fold a dynamic outlet onto its static sibling without duplicating it', async () => {
    const [meta] = await applyVueDocgenApiTempFixes(
      fixturePath('static-and-folded-slot.vue'),
      [metaWithoutSlots()],
      ['default']
    );

    expect(meta?.slots.map((slot) => slot.name)).toEqual(['header']);
  });

  it('should keep a static slot name when its v-bind spread happens to carry a "name" key', async () => {
    const [meta] = await applyVueDocgenApiTempFixes(
      fixturePath('static-slot-name-bind-spread.vue'),
      [metaWithoutSlots()],
      ['default']
    );

    expect(meta?.slots).toEqual([
      expect.objectContaining({ name: 'header', type: '{ name: unknown; item: unknown }' }),
    ]);
  });
});
