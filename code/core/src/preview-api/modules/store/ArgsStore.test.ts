import { describe, expect, it, vi } from 'vitest';

import type { PreparedStory } from 'storybook/internal/types';

import { parseArgsParam } from '../preview-web/parseArgsParam.ts';
import { ArgsStore } from './ArgsStore.ts';

vi.mock('storybook/internal/client-logger');

const stringType = { type: { name: 'string' } };
const booleanType = { type: { name: 'boolean' } };

describe('ArgsStore', () => {
  describe('setInitial / get', () => {
    it('returns in a straightforward way', () => {
      const store = new ArgsStore();
      store.setInitial({ id: 'id', initialArgs: { foo: 'bar' } } as any);
      expect(store.get('id')).toEqual({ foo: 'bar' });
    });

    it('throws if you try to get non-existent', () => {
      const store = new ArgsStore();
      expect(() => store.get('id')).toThrow(/No args known/);
    });

    describe('on second call for same story', () => {
      describe('if initialArgs are unchanged', () => {
        it('does nothing if the args are untouched', () => {
          const store = new ArgsStore();

          const previousStory = {
            id: 'id',
            initialArgs: { a: '1', b: '1' },
            argTypes: { a: stringType, b: stringType },
          } as any;
          store.setInitial(previousStory);

          const story = {
            id: 'id',
            initialArgs: { a: '1', b: '1' },
            argTypes: { a: stringType, b: stringType },
          } as any;

          store.setInitial(story);
          expect(store.get(story.id)).toEqual({ a: '1', b: '1' });
        });

        it('retains any arg changes', () => {
          const store = new ArgsStore();

          const previousStory = {
            id: 'id',
            initialArgs: { a: '1', b: false, c: 'unchanged' },
            argTypes: { a: stringType, b: booleanType, c: stringType },
          } as any;
          store.setInitial(previousStory);

          // NOTE: I'm not sure technically you should be allowed to set d here, but
          // let's make sure we behave sensibly if you do
          store.update('id', { a: 'update', b: true, d: 'update' });

          const story = {
            id: 'id',
            initialArgs: { a: '1', b: false, c: 'unchanged' },
            argTypes: { a: stringType, b: booleanType, c: stringType },
          } as any;

          store.setInitial(story);
          // In any case c is not retained.
          expect(store.get(story.id)).toEqual({ a: 'update', b: true, c: 'unchanged' });
        });
      });

      describe('when initialArgs change', () => {
        it('replaces old args with new if the args are untouched', () => {
          const store = new ArgsStore();

          const previousStory = {
            id: 'id',
            initialArgs: { a: '1', b: '1' },
            argTypes: { a: stringType, b: stringType },
          } as any;
          store.setInitial(previousStory);

          const story = {
            id: 'id',
            initialArgs: { a: '1', c: '1' },
            argTypes: { a: stringType, c: stringType },
          } as any;

          store.setInitial(story);
          expect(store.get(story.id)).toEqual({ a: '1', c: '1' });
        });

        it('applies the same delta if the args are changed', () => {
          const store = new ArgsStore();

          const previousStory = {
            id: 'id',
            initialArgs: { a: '1', b: '1' },
            argTypes: { a: stringType, b: stringType },
          } as any;
          store.setInitial(previousStory);

          // NOTE: I'm not sure technically you should be allowed to set c here
          store.update('id', { a: 'update', c: 'update' });

          const story = {
            id: 'id',
            initialArgs: { a: '2', d: '2' },
            argTypes: { a: stringType, d: stringType },
          } as any;

          store.setInitial(story);
          // In any case c is not retained.
          expect(store.get(story.id)).toEqual({ a: 'update', d: '2' });
        });
      });
    });
  });

  describe('update', () => {
    it('overrides on a per-key basis', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: {} } as any);

      store.update('id', { foo: 'bar' });
      expect(store.get('id')).toEqual({ foo: 'bar' });

      store.update('id', { baz: 'bing' });
      expect(store.get('id')).toEqual({ foo: 'bar', baz: 'bing' });
    });

    it('does not merge objects', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: {} } as any);

      store.update('id', { obj: { foo: 'bar' } });
      expect(store.get('id')).toEqual({ obj: { foo: 'bar' } });

      store.update('id', { obj: { baz: 'bing' } });
      expect(store.get('id')).toEqual({ obj: { baz: 'bing' } });
    });

    it('does not set keys to undefined, it simply unsets them', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: { foo: 'bar' } } as any);

      store.update('id', { foo: undefined });
      expect('foo' in store.get('id')).toBe(false);
    });
  });

  describe('updateFromPersisted', () => {
    it('ensures the types of args are correct', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: {} } as any);

      const story = {
        id: 'id',
        argTypes: { a: stringType },
      } as any;
      store.updateFromPersisted(story, { a: 'str' });
      expect(store.get('id')).toEqual({ a: 'str' });

      store.updateFromPersisted(story, { a: 42 });
      expect(store.get('id')).toEqual({ a: '42' });
    });

    it('merges objects and sparse arrays', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: { a: { foo: 'bar' }, b: ['1', '2', '3'] } } as any);

      const story = {
        id: 'id',
        argTypes: {
          a: { type: { name: 'object', value: { name: 'string' } } },
          b: { type: { name: 'array', value: { name: 'string' } } },
        },
      } as any;
      store.updateFromPersisted(story, { a: { baz: 'bing' } });
      expect(store.get('id')).toEqual({
        a: { foo: 'bar', baz: 'bing' },
        b: ['1', '2', '3'],
      });

      store.updateFromPersisted(story, { b: [, , '4'] });
      expect(store.get('id')).toEqual({
        a: { foo: 'bar', baz: 'bing' },
        b: ['1', '2', '4'],
      });
    });

    it('checks args are allowed options', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: {} } as any);

      const story = {
        id: 'id',
        argTypes: { a: { type: { name: 'string' }, options: ['a', 'b'] } },
      } as any;
      store.updateFromPersisted(story, { a: 'random' });
      expect(store.get('id')).toEqual({});

      store.updateFromPersisted(story, { a: 'a' });
      expect(store.get('id')).toEqual({ a: 'a' });
    });

    it('keeps numeric strings of args parsed from the URL', () => {
      const store = new ArgsStore();

      store.setInitial({ id: 'id', initialArgs: { code: 'abc', month: '01', count: 1 } } as any);

      const story = {
        id: 'id',
        argTypes: {
          code: stringType,
          month: { type: { name: 'string' }, options: ['01', '02', '03'] },
          count: { type: { name: 'number' } },
        },
      } as any;
      store.updateFromPersisted(story, parseArgsParam('code:007;month:03;count:1.50'));
      expect(store.get('id')).toEqual({ code: '007', month: '03', count: 1.5 });
    });

    it('keeps Date args parsed from the URL instead of turning them into empty objects or dropping them', () => {
      const store = new ArgsStore();
      const initialDate = new Date('2010-02-01T00:00:00.000Z');
      const urlDate = new Date('2024-01-02T03:04:05.000Z');
      const story = {
        id: 'id',
        initialArgs: { inferredDate: initialDate, typedDate: initialDate },
        argTypes: {
          inferredDate: { control: { type: 'date' }, type: { name: 'object', value: {} } },
          typedDate: { control: { type: 'date' }, type: { name: 'date' } },
        },
      } as unknown as PreparedStory;
      store.setInitial(story);

      store.updateFromPersisted(
        story,
        parseArgsParam(
          'inferredDate:!date(2024-01-02T03:04:05.000Z);typedDate:!date(2024-01-02T03:04:05.000Z)'
        )
      );
      expect(store.get('id')).toEqual({ inferredDate: urlDate, typedDate: urlDate });

      store.updateFromPersisted(
        story,
        parseArgsParam('inferredDate:1704164645000;typedDate:1704164645000')
      );
      expect(store.get('id')).toEqual({
        inferredDate: 1704164645000,
        typedDate: 1704164645000,
      });
    });

    // Server docgen keeps `argTypes` annotation-only, so a plain `args` entry arrives here without
    // a type and would be dropped rather than applied.
    describe('with docgenServer', () => {
      it('types args from their initial value when the story declares no argTypes', () => {
        vi.stubGlobal('FEATURES', { docgenServer: true });
        const store = new ArgsStore();
        const urlDate = new Date('2024-01-02T03:04:05.000Z');
        const story = {
          id: 'id',
          initialArgs: { a: 'Button', b: 1, c: new Date('2010-02-01T00:00:00.000Z') },
          argTypes: {},
        } as unknown as PreparedStory;
        store.setInitial(story);

        store.updateFromPersisted(
          story,
          parseArgsParam('a:Hello+world;b:42.0;c:!date(2024-01-02T03:04:05.000Z)')
        );
        expect(store.get('id')).toEqual({ a: 'Hello world', b: 42, c: urlDate });

        store.updateFromPersisted(story, parseArgsParam('c:1704164645000'));
        expect(store.get('id')).toEqual({ a: 'Hello world', b: 42, c: 1704164645000 });
      });
    });
  });
});
