import { describe, expect, it, vi } from 'vitest';

import { ArgsStore } from './ArgsStore';

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

    it('preserves function properties in nested objects not present in the update', () => {
      const store = new ArgsStore();
      const onClick = vi.fn();

      store.setInitial({
        id: 'id',
        initialArgs: { buttonProps: { title: 'Click me', onClick, variant: 'primary' } },
      } as any);

      // Simulate what happens when manager sends an update after channel serialization
      // stripped the function: the update lacks `onClick`
      store.update('id', { buttonProps: { title: 'New title', variant: 'primary' } });

      const result = store.get('id');
      expect(result.buttonProps.title).toBe('New title');
      expect(result.buttonProps.variant).toBe('primary');
      expect(result.buttonProps.onClick).toBe(onClick);
    });

    it('allows non-function properties to be removed from nested objects', () => {
      const store = new ArgsStore();
      const onClick = vi.fn();

      store.setInitial({
        id: 'id',
        initialArgs: { buttonProps: { title: 'Click me', onClick, variant: 'primary' } },
      } as any);

      // User explicitly removes `variant` from the Controls panel object editor
      store.update('id', { buttonProps: { title: 'Click me' } });

      const result = store.get('id');
      expect(result.buttonProps.title).toBe('Click me');
      expect(result.buttonProps.onClick).toBe(onClick);
      expect('variant' in result.buttonProps).toBe(false);
    });

    it('preserves function properties at the top level', () => {
      const store = new ArgsStore();
      const onSubmit = vi.fn();

      store.setInitial({ id: 'id', initialArgs: { onSubmit, label: 'old' } } as any);

      store.update('id', { label: 'new' });

      const result = store.get('id');
      expect(result.label).toBe('new');
      expect(result.onSubmit).toBe(onSubmit);
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
  });
});
