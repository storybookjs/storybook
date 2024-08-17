import { beforeEach, describe, expect, it } from 'vitest';

import { SharedState } from './SharedState';

class MockChannel {
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};

  on(event: string, listener: (...args: any[]) => void) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener];
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.listeners[event] = (this.listeners[event] ?? []).filter((l) => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    // setTimeout is used to simulate the asynchronous nature of the real channel
    (this.listeners[event] || []).forEach((listener) => setTimeout(() => listener(...args)));
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SharedState', () => {
  let channel: MockChannel;
  let a: SharedState;
  let b: SharedState;

  beforeEach(() => {
    channel = new MockChannel();
    a = new SharedState(channel);
    b = new SharedState(channel);
  });

  it('should initialize with an empty object', () => {
    expect(a.state).toEqual({});
  });

  it('should set and get values correctly', () => {
    a.set('foo', 'bar');
    a.set('baz', 123);

    expect(a.get('foo')).toBe('bar');
    expect(a.get('baz')).toBe(123);
    expect(a.get('qux')).toBeUndefined();
  });

  it('should remove values correctly', () => {
    a.set('foo', 'bar');
    a.set('foo', undefined);

    expect(a.get('foo')).toBeUndefined();
  });

  it('should (eventually) share state between instances', async () => {
    a.set('foo', 'bar');
    await tick(); // setState
    expect(b.get('foo')).toBe('bar');
  });

  it('should (eventually) share state with new instances', async () => {
    a.set('foo', 'bar');
    const c = new SharedState(channel);

    expect(c.get('foo')).toBeUndefined();
    await tick(); // getState
    await tick(); // setState
    expect(c.get('foo')).toBe('bar');
  });

  it('should not overwrite newer values', async () => {
    a.set('foo', 'bar');
    b.set('foo', 'baz'); // conflict: "bar" was not yet synced
    await tick(); // setState (one side)
    await tick(); // setState (other side)

    // Neither accepts the other's value
    expect(a.get('foo')).toBe('bar');
    expect(b.get('foo')).toBe('baz');

    b.set('foo', 'baz'); // try again
    await tick(); // setState
    expect(a.get('foo')).toBe('baz');
  });
});