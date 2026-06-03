// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { mutableRecordLookupServiceDef } from './fixtures.ts';
import { clearRegistry, registerService } from './service-registry.ts';
import { useServiceCommand } from './use-service-command.ts';

afterEach(() => {
  clearRegistry();
});

describe('useServiceCommand', () => {
  it('returns a callable async function', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() => useServiceCommand(service, 'assignRecordField'));

    await result.current({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('returns the same function reference across re-renders', () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result, rerender } = renderHook(() => useServiceCommand(service, 'assignRecordField'));

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
