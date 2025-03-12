import { beforeEach, expect, it, vi } from 'vitest';

import { fn, onMockCall, spyOn } from './spy';

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
