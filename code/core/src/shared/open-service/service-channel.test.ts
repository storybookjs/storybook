import { describe, expect, it } from 'vitest';
import * as v from 'valibot';

import {
  decodePointer,
  encodePointer,
  entrySchema,
  jsonPatchOperationSchema,
  jsonPointerSchema,
} from './service-channel.ts';

const validEntry = {
  serviceId: 'svc',
  stamp: { seq: 1, runtimeId: 'writer', counter: 1 },
  command: 'setValue',
  patch: [{ op: 'replace' as const, path: '/n', value: 1 }],
};

describe('JSON Pointer', () => {
  it('encodes and decodes ~ and / in segments', () => {
    expect(encodePointer(['a~b', 'c/d'])).toBe('/a~0b/c~1d');
    expect(decodePointer('/a~0b/c~1d')).toEqual(['a~b', 'c/d']);
  });
});

describe('jsonPointerSchema', () => {
  it('accepts RFC 6901 paths and rejects missing slash, bad escapes, or reserved segments', () => {
    expect(v.safeParse(jsonPointerSchema, '/n').success).toBe(true);
    expect(v.safeParse(jsonPointerSchema, '/a~0b').success).toBe(true);
    expect(v.safeParse(jsonPointerSchema, '/a~1b').success).toBe(true);
    expect(v.safeParse(jsonPointerSchema, 'n').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/a~2b').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/a~').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/$boom').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/ok/$x').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/__proto__').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/constructor').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/prototype').success).toBe(false);
    expect(v.safeParse(jsonPointerSchema, '/nested/__proto__/x').success).toBe(false);
  });
});

describe('jsonPatchOperationSchema', () => {
  it('accepts add, replace, and remove', () => {
    expect(v.safeParse(jsonPatchOperationSchema, { op: 'add', path: '/n', value: 1 }).success).toBe(
      true
    );
    expect(
      v.safeParse(jsonPatchOperationSchema, { op: 'replace', path: '/n', value: 1 }).success
    ).toBe(true);
    expect(v.safeParse(jsonPatchOperationSchema, { op: 'remove', path: '/n' }).success).toBe(true);
  });

  it('rejects move, copy, and test', () => {
    expect(
      v.safeParse(jsonPatchOperationSchema, { op: 'move', path: '/a', from: '/b' }).success
    ).toBe(false);
    expect(
      v.safeParse(jsonPatchOperationSchema, { op: 'copy', path: '/a', from: '/b' }).success
    ).toBe(false);
    expect(
      v.safeParse(jsonPatchOperationSchema, { op: 'test', path: '/n', value: 1 }).success
    ).toBe(false);
  });
});

describe('entrySchema', () => {
  it('accepts a valid envelope and ignores unknown fields', () => {
    const parsed = v.safeParse(entrySchema, { ...validEntry, extra: 'ok', meta: { n: 1 } });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.output).toEqual(validEntry);
    }
  });

  it('rejects an empty patch, counter 0, and a missing stamp', () => {
    expect(v.safeParse(entrySchema, { ...validEntry, patch: [] }).success).toBe(false);
    expect(
      v.safeParse(entrySchema, {
        ...validEntry,
        stamp: { seq: 1, runtimeId: 'writer', counter: 0 },
      }).success
    ).toBe(false);
    expect(
      v.safeParse(entrySchema, {
        ...validEntry,
        stamp: { seq: 0, runtimeId: 'writer', counter: 1 },
      }).success
    ).toBe(false);
    expect(
      v.safeParse(entrySchema, { serviceId: 'svc', command: 'setValue', patch: validEntry.patch })
        .success
    ).toBe(false);
  });
});
