import { describe, expect, it } from 'vitest';

import { buildCapturePayload, classifyProp, sanitizeContainerValue } from './capture.ts';

const reactElement = {
  $$typeof: Symbol.for('react.element'),
  type: 'h2',
  key: null,
  props: { children: 'Card title' },
  _owner: {},
} as unknown as object;
// React elements reference fibers that cycle — the transport hazard.
(reactElement as { _owner: unknown })._owner = {
  return: { alternate: { _owner: reactElement } },
};

describe('sanitizeContainerValue', () => {
  it('replaces React elements inside arrays with sentinels', () => {
    const sanitized = sanitizeContainerValue([reactElement, reactElement]) as unknown[];
    expect(sanitized).toHaveLength(2);
    expect(sanitized[0]).toMatchObject({ __sbDevtools: 'react-element', label: '<h2 />' });
  });

  it('replaces nested functions with function sentinels', () => {
    const sanitized = sanitizeContainerValue({ handler: function handleSelect() {} }) as {
      handler: { __sbDevtools: string; label: string };
    };
    expect(sanitized.handler).toMatchObject({
      __sbDevtools: 'function',
      label: 'a function (ƒ handleSelect)',
    });
  });

  it('flags circular references instead of recursing forever', () => {
    const circular: Record<string, unknown> = { label: 'hi' };
    circular.self = circular;
    const sanitized = sanitizeContainerValue(circular) as { self: { __sbDevtools: string } };
    expect(sanitized.self.__sbDevtools).toBe('unknown');
  });

  it('leaves JSON-safe structures untouched', () => {
    expect(sanitizeContainerValue(['alpha', 3, { nested: true }])).toEqual([
      'alpha',
      3,
      { nested: true },
    ]);
  });

  it('the sanitized output survives JSON.stringify', () => {
    const payload = buildCapturePayload({
      componentName: 'Card',
      source: null,
      props: { children: [reactElement] },
      reactVersion: 'react>=19.2',
    });
    expect(() => JSON.stringify(payload)).not.toThrow();
  });
});

describe('classifyProp', () => {
  it('sanitizes array values in place', () => {
    const captured = classifyProp('children', [reactElement]);
    expect(captured.kind).toBe('array');
    expect(JSON.stringify(captured.value)).toContain('react-element');
  });

  it('keeps top-level React elements preview-only rather than shipping them', () => {
    const captured = classifyProp('slot', reactElement);
    expect(captured.kind).toBe('unknown');
    expect(captured.value).toBeUndefined();
    expect(captured.preview).toBe('<h2 />');
  });
});
