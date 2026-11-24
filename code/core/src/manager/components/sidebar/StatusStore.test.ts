import { describe, expect, it, vi } from 'vitest';

import { createStatusStore, type RowStatus } from './StatusStore.tsx';

const rowStatus = (change: string, test: string) => ({ change, test }) as RowStatus;
const rows = (record: Record<string, RowStatus>) => new Map(Object.entries(record));

describe('createStatusStore', () => {
  it('returns one shared snapshot for a row it has no status for', () => {
    const store = createStatusStore();

    // useSyncExternalStore compares snapshots with Object.is and re-reads on every notification,
    // so a fresh object here would re-render the row forever.
    expect(store.getRowStatus('absent')).toBe(store.getRowStatus('absent'));
    expect(store.getRowStatus('absent')).toEqual({
      change: 'status-value:unknown',
      test: 'status-value:unknown',
    });
  });

  it('has no status for a row whose id is an Object.prototype key', () => {
    const store = createStatusStore();

    expect(store.getRowStatus('constructor')).toEqual({
      change: 'status-value:unknown',
      test: 'status-value:unknown',
    });
  });

  it('keeps the snapshot of a row whose own values are unchanged', () => {
    const store = createStatusStore();
    store.setState(
      rows({
        a: rowStatus('status-value:unknown', 'status-value:success'),
        b: rowStatus('status-value:unknown', 'status-value:success'),
      })
    );
    const before = store.getRowStatus('b');

    store.setState(
      rows({
        a: rowStatus('status-value:unknown', 'status-value:error'),
        b: rowStatus('status-value:unknown', 'status-value:success'),
      })
    );

    expect(store.getRowStatus('b')).toBe(before);
  });

  it('gives a row a new snapshot when either of its values changes', () => {
    const store = createStatusStore();
    store.setState(rows({ a: rowStatus('status-value:unknown', 'status-value:success') }));
    const beforeTest = store.getRowStatus('a');

    store.setState(rows({ a: rowStatus('status-value:unknown', 'status-value:error') }));
    const afterTest = store.getRowStatus('a');
    expect(afterTest).not.toBe(beforeTest);
    expect(afterTest.test).toBe('status-value:error');

    store.setState(rows({ a: rowStatus('status-value:new', 'status-value:error') }));
    expect(store.getRowStatus('a')).not.toBe(afterTest);
  });

  it('drops a row that the next state no longer carries', () => {
    const store = createStatusStore();
    store.setState(rows({ a: rowStatus('status-value:unknown', 'status-value:success') }));

    store.setState(rows({}));

    expect(store.getRowStatus('a')).toEqual({
      change: 'status-value:unknown',
      test: 'status-value:unknown',
    });
  });

  it('notifies every subscriber until it unsubscribes', () => {
    const store = createStatusStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState(rows({ a: rowStatus('status-value:unknown', 'status-value:success') }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setState(rows({ a: rowStatus('status-value:unknown', 'status-value:error') }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
