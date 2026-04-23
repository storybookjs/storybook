// Type-level smoke tests for the ChangeDetectionAdapter contract.
import { describe, expectTypeOf, it } from 'vitest';

import type { ChangeDetectionAdapter, FileChangeEvent, ResolveConfig } from './types.ts';

describe('ChangeDetectionAdapter types', () => {
  it('FileChangeEvent is a discriminated union over add | change | unlink', () => {
    expectTypeOf<FileChangeEvent>().toEqualTypeOf<
      | { kind: 'add'; path: string }
      | { kind: 'change'; path: string }
      | { kind: 'unlink'; path: string }
    >();
  });

  it('ResolveConfig.alias accepts both Record<string, string> and Array<{find, replacement}>', () => {
    expectTypeOf<Record<string, string>>().toMatchTypeOf<NonNullable<ResolveConfig['alias']>>();
    expectTypeOf<Array<{ find: string | RegExp; replacement: string }>>().toMatchTypeOf<
      NonNullable<ResolveConfig['alias']>
    >();
  });

  it('ChangeDetectionAdapter.getResolveConfig returns Promise<ResolveConfig>', () => {
    expectTypeOf<
      ChangeDetectionAdapter['getResolveConfig']
    >().returns.resolves.toEqualTypeOf<ResolveConfig>();
  });

  it('ChangeDetectionAdapter.onFileChange returns an unsubscribe function', () => {
    expectTypeOf<ChangeDetectionAdapter['onFileChange']>().returns.toEqualTypeOf<() => void>();
  });
});
