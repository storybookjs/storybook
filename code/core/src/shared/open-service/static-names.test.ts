import { describe, expect, it } from 'vitest';

import { componentIdToStaticName } from './static-names.ts';

describe('componentIdToStaticName', () => {
  it('passes short portable names through byte-identical', () => {
    expect(componentIdToStaticName('button')).toBe('button');
    expect(componentIdToStaticName('addons-docs-codepanel')).toBe('addons-docs-codepanel');
    expect(componentIdToStaticName('component.button_1.5')).toBe('component.button_1.5');
  });

  it('passes derived digest names and the empty sentinel through (idempotence)', () => {
    expect(componentIdToStaticName('id-cb31c4b880a3cea9')).toBe('id-cb31c4b880a3cea9');
    expect(componentIdToStaticName('_empty_')).toBe('_empty_');
    expect(componentIdToStaticName(componentIdToStaticName('😀'))).toBe(
      componentIdToStaticName('😀')
    );
  });

  it('maps the empty id to the _empty_ sentinel', () => {
    expect(componentIdToStaticName('')).toBe('_empty_');
  });

  it('passes a 200-character portable id and hashes a 201-character one', () => {
    const ascii200 = 'a'.repeat(200);

    expect(componentIdToStaticName(ascii200)).toBe(ascii200);
    expect(componentIdToStaticName('a'.repeat(201))).toMatch(/^id-[0-9a-f]{16}$/);
  });

  it('hashes ids with non-portable characters or non-ASCII bytes', () => {
    for (const id of ['😀', 'a b', 'a*b', 'a:b', 'Кнопки', '界'.repeat(30)]) {
      expect(componentIdToStaticName(id)).toMatch(/^id-[0-9a-f]{16}$/);
    }
  });

  it('produces deterministic, distinct digest names', () => {
    expect(componentIdToStaticName('😀')).toBe('id-cb31c4b880a3cea9');
    expect(componentIdToStaticName('界'.repeat(30))).toBe('id-2da2b0e533241084');
    expect(componentIdToStaticName('界'.repeat(30))).not.toBe(
      componentIdToStaticName('界'.repeat(31))
    );
  });

  it('spreads both lanes on palindromic ids', () => {
    // With identical lanes the digest would collapse to 32 bits for palindromic input.
    const digest = componentIdToStaticName('a'.repeat(201)).slice(3);

    expect(digest.slice(0, 8)).not.toBe(digest.slice(8));
  });

  it('derives names that survive URL decoding, tar extraction, and filesystem limits', () => {
    for (const id of ['button', '😀', 'Кнопки', 'a b', 'a*b', '界'.repeat(30)]) {
      const name = componentIdToStaticName(id);

      // Static hosts percent-decode request paths before their filesystem lookup, so a
      // literal `%` on disk would be unreachable through any fetch.
      expect(decodeURIComponent(name)).toBe(name);
      // The allowlist keeps the name extractable by Windows tar tooling and valid on
      // every supported filesystem.
      expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
      // `.json` must still fit under the 255-byte per-component filename limit.
      expect(name.length).toBeLessThanOrEqual(255);
    }
  });
});
