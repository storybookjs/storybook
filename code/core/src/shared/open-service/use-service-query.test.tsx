// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { mutableRecordLookupServiceDef } from './fixtures.ts';
import { clearRegistry, registerService } from './service-registry.ts';
import { useServiceQuery } from './use-service-query.ts';

afterEach(() => {
  clearRegistry();
});

describe('useServiceQuery', () => {
  it('returns the initial synchronous query result', () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service, 'getRecordFields', { entryId: 'a' })
    );

    expect(result.current).toBeNull();
  });

  it('re-renders when the query result changes after a command', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service, 'getRecordFields', { entryId: 'a' })
    );

    expect(result.current).toBeNull();

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'color',
      fieldValue: 'red',
    });

    await waitFor(() => {
      expect(result.current).toEqual({ color: 'red' });
    });
  });

  it('does not re-render for an unrelated entry', async () => {
    const service = registerService(mutableRecordLookupServiceDef);
    let renderCount = 0;

    renderHook(() => {
      renderCount++;
      return useServiceQuery(service, 'getRecordFields', { entryId: 'a' });
    });

    const countAfterMount = renderCount;

    await service.commands.assignRecordField({
      entryId: 'b',
      fieldKey: 'other',
      fieldValue: 'value',
    });

    // Wait a tick to let any spurious re-renders fire.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    // No re-render because the subscribed key ('a') was not affected.
    expect(renderCount).toBe(countAfterMount);
  });

  it('updates when input changes', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'k',
      fieldValue: 'v',
    });

    let currentEntryId = 'b';
    const { result, rerender } = renderHook(() =>
      useServiceQuery(service, 'getRecordFields', { entryId: currentEntryId })
    );

    expect(result.current).toBeNull();

    currentEntryId = 'a';
    rerender();

    expect(result.current).toEqual({ k: 'v' });
  });

  it('accumulates incremental updates', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service, 'getRecordFields', { entryId: 'a' })
    );

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'x', fieldValue: '1' });

    await waitFor(() => {
      expect(result.current).toEqual({ x: '1' });
    });

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'y', fieldValue: '2' });

    await waitFor(() => {
      expect(result.current).toEqual({ x: '1', y: '2' });
    });
  });

  it('maintains referential stability when result is deeply equal', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useServiceQuery(service, 'getRecordFields', { entryId: 'a' });
    });

    const firstRef = result.current;
    const countAfterMount = renderCount;

    // Assign the same value again — deeply equal, so no re-render.
    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    // Wait a tick to let any spurious re-renders fire.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(result.current).toBe(firstRef);
    expect(renderCount).toBe(countAfterMount);
  });
});
