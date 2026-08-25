import { describe, expect, it } from 'vitest';

import { OpenServiceValidationError } from '../../server-errors.ts';
import { deserializeError, serializeError } from './service-error-serialization.ts';

describe('serializeError / deserializeError', () => {
  it('round-trips name, message, and stack', () => {
    const original = new TypeError('boom');
    const restored = deserializeError(serializeError(original));

    expect(restored).toBeInstanceOf(Error);
    expect(restored.name).toBe('TypeError');
    expect(restored.message).toBe('boom');
    expect(restored.stack).toBe(original.stack);
  });

  it('preserves the nested cause chain as real Errors', () => {
    const root = new Error('root');
    const middle = new Error('middle', { cause: root });
    const top = new Error('top', { cause: middle });

    const restored = deserializeError(serializeError(top));

    expect(restored.message).toBe('top');
    expect((restored.cause as Error).message).toBe('middle');
    expect((restored.cause as Error).cause).toBeInstanceOf(Error);
    expect(((restored.cause as Error).cause as Error).message).toBe('root');
  });

  it('preserves an aggregated array of causes (as produced by the .loaded() drain)', () => {
    const primary = new Error('primary');
    primary.cause = { aggregated: [new Error('a'), new Error('b')] };

    const restored = deserializeError(serializeError(primary));
    const aggregated = (restored.cause as { aggregated: Error[] }).aggregated;

    expect(aggregated).toHaveLength(2);
    expect(aggregated[0]).toBeInstanceOf(Error);
    expect(aggregated[0].message).toBe('a');
    expect(aggregated[1].message).toBe('b');
  });

  it('retains Storybook error fields like code and fromStorybook', () => {
    const original = new OpenServiceValidationError({
      kind: 'command',
      serviceId: 'svc',
      name: 'run',
      phase: 'input',
      issues: [{ message: 'nope' }],
    });

    const restored = deserializeError(serializeError(original)) as Error & {
      code?: number;
      fromStorybook?: boolean;
    };

    expect(restored.message).toBe(original.message);
    expect(restored.fromStorybook).toBe(true);
    expect(restored.code).toBe(5);
  });

  it('produces a transport-safe (structured-cloneable) payload', () => {
    const error = new Error('with fn');
    (error as unknown as Record<string, unknown>).callback = () => 'dropped';
    (error as unknown as Record<string, unknown>).count = 3;

    const serialized = serializeError(error);

    expect(() => structuredClone(serialized)).not.toThrow();
    expect(serialized.properties).toMatchObject({ count: 3 });
    expect(serialized.properties?.callback).toBeUndefined();
  });

  it('wraps non-Error throws in a real Error', () => {
    const restored = deserializeError(serializeError('just a string'));

    expect(restored).toBeInstanceOf(Error);
    expect(restored.message).toBe('just a string');
  });
});
