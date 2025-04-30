// @vitest-environment happy-dom
import { describe, it, test } from 'vitest';

import { action } from 'storybook/actions';
import { expect, fn, isMockFunction } from 'storybook/test';
import { traverseArgs } from 'storybook/test/preview';

it('storybook expect and fn can be used in vitest test', () => {
  const spy = fn();
  spy(1);
  expect(spy).toHaveBeenCalledWith(1);
});

describe('traverseArgs', () => {
  const args = {
    deep: {
      deeper: {
        fnKey: fn(),
        actionKey: action('name'),
      },
    },
    arg2: Object.freeze({ frozen: true }),
  };

  expect(args.deep.deeper.fnKey.getMockName()).toEqual('spy');

  const traversed = traverseArgs(args) as typeof args;

  test('The same structure is maintained', () =>
    expect(traversed).toEqual({
      deep: {
        deeper: {
          fnKey: args.deep.deeper.fnKey,
          actionKey: args.deep.deeper.actionKey,
        },
      },
      // We don't mutate frozen objects, but we do insert them back in the tree
      arg2: args.arg2,
    }));

  test('The mock name is mutated to be the arg key', () =>
    expect(traversed.deep.deeper.fnKey.getMockName()).toEqual('fnKey'));

  const actionFn = traversed.deep.deeper.actionKey;

  test('Actions are wrapped in a spy', () => expect(isMockFunction(actionFn)).toBeTruthy());
  test('The spy of the action is also matching the arg key ', () =>
    expect(isMockFunction(actionFn) && actionFn.getMockName()).toEqual('actionKey'));
});
