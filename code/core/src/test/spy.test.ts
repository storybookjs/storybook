import { beforeEach, expect, it, vi } from 'vitest';

import { fn, onMockCall, spyOn } from './spy.ts';

const vitestSpy = vi.fn();

beforeEach(() => {
  const unsubscribe = onMockCall(vitestSpy);
  return () => unsubscribe();
});

it('mocks are reactive', () => {
  const storybookSpy = fn();
  storybookSpy(1);
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, [1]);
});

class Foo {
  bar = 'bar';

  transform(postfix: string) {
    return this.bar + postfix;
  }
}
const foo = new Foo();

it('this is correctly binded when making spies reactive', () => {
  const storybookSpy = spyOn(foo, 'transform');
  expect(foo.transform('!')).toEqual('bar!');
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, ['!']);
});

it('this is correctly binded after mock implementation', () => {
  const storybookSpy = spyOn(foo, 'transform').mockImplementation(function (this: Foo) {
    return this.bar + 'mocked';
  });

  expect(foo.transform('!')).toEqual('barmocked');
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, ['!']);
});

it('spied classes can be constructed with new', () => {
  class Thing {
    constructor(public value: number) {}
  }
  const container = { Thing };
  const storybookSpy = spyOn(container, 'Thing');

  const thing = new container.Thing(1);

  expect(thing.value).toBe(1);
  expect(thing).toBeInstanceOf(Thing);
  expect(storybookSpy.mock.instances[0]).toBe(thing);
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, [1]);
});

it('spied function constructors keep their instance when called with new', () => {
  function Legacy(this: { value: number }, value: number) {
    this.value = value;
  }
  const container = { Legacy };
  const storybookSpy = spyOn(container, 'Legacy');

  const LegacyConstructor = container.Legacy as unknown as new (value: number) => { value: number };
  const legacy = new LegacyConstructor(2);

  expect(legacy.value).toBe(2);
  expect(storybookSpy.mock.instances[0]).toBe(legacy);
});
