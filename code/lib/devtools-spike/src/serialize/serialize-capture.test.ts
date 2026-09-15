import { describe, expect, it } from 'vitest';

import type { CapturedProp, CapturePayload } from '../types.ts';
import { serializeCapture } from './serialize-capture.ts';

const prop = (name: string, kind: CapturedProp['kind'], value?: unknown): CapturedProp => ({
  name,
  kind,
  ...(value !== undefined ? { value } : {}),
});

const payloadWith = (props: CapturedProp[]): CapturePayload => ({
  componentName: 'Button',
  source: null,
  props,
  reactVersion: '19.2.8',
  capturedAt: 0,
});

const reactElement = {
  $$typeof: Symbol.for('react.element'),
  type: 'button',
  key: null,
  props: { children: 'Click me' },
};

describe('serializeCapture', () => {
  describe('serializable kinds become args', () => {
    it('maps every primitive shape into args', () => {
      const result = serializeCapture(
        payloadWith([
          prop('label', 'primitive', 'Save'),
          prop('count', 'primitive', 2),
          prop('disabled', 'primitive', false),
          prop('icon', 'primitive', null),
        ])
      );

      expect(result.args).toEqual({ label: 'Save', count: 2, disabled: false, icon: null });
      expect(result.flagged).toEqual([]);
      expect(result.argTypes).toEqual({});
    });

    it('keeps arrays and plain objects as args', () => {
      const items = ['a', 'b'];
      const nested = { depth: { deeper: true } };
      const result = serializeCapture(
        payloadWith([prop('items', 'array', items), prop('nested', 'object', nested)])
      );

      expect(result.args).toEqual({ items, nested });
      expect(result.flagged).toEqual([]);
      expect(result.argTypes).toEqual({});
    });
  });

  describe('unrepresentable kinds are flagged with guidance', () => {
    it('flags function props and documents them in argTypes', () => {
      const result = serializeCapture(payloadWith([prop('onClick', 'function', () => {})]));

      expect(result.args).toEqual({});
      expect(result.flagged).toHaveLength(1);
      expect(result.flagged[0]).toMatchObject({ name: 'onClick', reason: 'function' });
      expect(result.flagged[0]?.guidance).toContain('function');
      expect(result.argTypes.onClick).toEqual({
        control: false,
        description: result.flagged[0]?.guidance,
      });
    });

    it('flags function props that arrived without a value', () => {
      const result = serializeCapture(payloadWith([prop('onClick', 'function')]));

      expect(result.flagged[0]).toMatchObject({ name: 'onClick', reason: 'function' });
      expect(result.flagged[0]?.guidance).toContain('no value');
    });

    it('flags class instances with the constructor name', () => {
      const result = serializeCapture(
        payloadWith([prop('createdAt', 'class-instance', new Date('2026-01-01T00:00:00Z'))])
      );

      expect(result.flagged[0]).toMatchObject({ name: 'createdAt', reason: 'class-instance' });
      expect(result.flagged[0]?.guidance).toContain('Date');
    });

    it('flags symbol props', () => {
      const result = serializeCapture(payloadWith([prop('mode', 'symbol', Symbol('mode'))]));

      expect(result.flagged[0]).toMatchObject({ name: 'mode', reason: 'symbol' });
      expect(result.argTypes.mode?.control).toBe(false);
    });

    it('flags unknown-kind props even when a value arrived', () => {
      const result = serializeCapture(payloadWith([prop('slot', 'unknown', reactElement)]));

      expect(result.flagged[0]).toMatchObject({ name: 'slot', reason: 'unknown' });
      expect(result.flagged[0]?.guidance).toContain('React element');
    });

    it('flags circular references instead of recursing forever', () => {
      const circular: Record<string, unknown> = { label: 'hi' };
      circular.self = circular;

      const result = serializeCapture(payloadWith([prop('tree', 'object', circular)]));

      expect(result.flagged[0]).toMatchObject({ name: 'tree', reason: 'unknown' });
      expect(result.flagged[0]?.guidance).toContain('circular');
      expect(result.args).toEqual({});
    });

    it('flags circular references through arrays', () => {
      const rows: unknown[] = [{ id: 1 }];
      rows.push(rows);

      const result = serializeCapture(payloadWith([prop('rows', 'array', rows)]));

      expect(result.flagged[0]).toMatchObject({ name: 'rows', reason: 'unknown' });
      expect(result.flagged[0]?.guidance).toContain('circular');
    });

    it('locates unrepresentable values nested in objects and arrays', () => {
      const result = serializeCapture(
        payloadWith([
          prop('form', 'object', { user: { name: 'Ada', save: () => {} } }),
          prop('items', 'array', ['ok', reactElement]),
        ])
      );

      expect(result.flagged).toHaveLength(2);
      expect(result.flagged[0]?.guidance).toContain('"form.user.save"');
      expect(result.flagged[1]?.guidance).toContain('"items[1]"');
    });

    it('flags non-finite numbers and bigints', () => {
      const result = serializeCapture(
        payloadWith([
          prop('ratio', 'primitive', Number.NaN),
          prop('huge', 'primitive', 9007199254740993n),
        ])
      );

      expect(result.flagged).toHaveLength(2);
      expect(result.flagged.map((flagged) => flagged.reason)).toEqual(['unknown', 'unknown']);
    });

    it('flags reserved-key prop names', () => {
      const result = serializeCapture(payloadWith([prop('__proto__', 'object', { a: 1 })]));

      expect(result.flagged[0]).toMatchObject({ name: '__proto__', reason: 'unknown' });
      expect(result.flagged[0]?.guidance).toContain('reserved');
    });
  });

  describe('every prop lands somewhere (visible degradation)', () => {
    it('puts each prop in args or flagged, and argTypes mirror flagged', () => {
      const props: CapturedProp[] = [
        prop('label', 'primitive', 'Save'),
        prop('count', 'primitive', 2),
        prop('items', 'array', [1, 2]),
        prop('meta', 'object', { open: true }),
        prop('onClick', 'function', () => {}),
        prop('onMissing', 'function'),
        prop('createdAt', 'class-instance', new Date('2026-01-01T00:00:00Z')),
        prop('createdAtMissing', 'class-instance'),
        prop('mode', 'symbol', Symbol('mode')),
        prop('modeMissing', 'symbol'),
        prop('slot', 'unknown', reactElement),
        prop('unknownMissing', 'unknown'),
      ];

      const result = serializeCapture(payloadWith(props));

      const argNames = Object.keys(result.args).sort();
      const flaggedNames = result.flagged.map((flagged) => flagged.name).sort();
      expect([...argNames, ...flaggedNames].sort()).toEqual(props.map((p) => p.name).sort());
      expect(Object.keys(result.argTypes).sort()).toEqual(flaggedNames);
      for (const flagged of result.flagged) {
        expect(flagged.guidance.length).toBeGreaterThan(0);
      }
    });
  });

  describe('story naming', () => {
    it('names the first story Primary', () => {
      const result = serializeCapture(payloadWith([prop('label', 'primitive', 'Save')]));
      expect(result.storyName).toBe('Primary');
    });

    it('picks the next free Primary variant when Primary is taken', () => {
      const result = serializeCapture(payloadWith([]), {
        existingStoryNames: ['Primary', 'Secondary'],
      });
      expect(result.storyName).toBe('Primary2');
    });

    it('skips existing numbered variants', () => {
      const result = serializeCapture(payloadWith([]), {
        existingStoryNames: ['Primary', 'Primary2', 'Primary3'],
      });
      expect(result.storyName).toBe('Primary4');
    });
  });
});
