import type { BoundFunctions } from '@testing-library/dom';
import type { userEvent } from '@testing-library/user-event';

import { instrument } from 'storybook/internal/instrumenter';

import { Assertion } from 'chai';

import { expect as rawExpect } from './expect';
import { type queries } from './testing-library';

export * from './spy';

type Queries = BoundFunctions<typeof queries>;

export type UserEventObject = ReturnType<typeof userEvent.setup>;

declare module 'storybook/internal/csf' {
  interface Canvas extends Queries {}
  interface StoryContext {
    userEvent: UserEventObject;
  }
}

export const { expect } = instrument(
  { expect: rawExpect },
  {
    getKeys: (obj: object, depth) => {
      if ('constructor' in obj && obj.constructor === Assertion) {
        const privateApi = ['assert', '__methods', '__flags', '_obj'];
        const keys = Object.keys(Object.getPrototypeOf(obj)).filter(
          (it) => !privateApi.includes(it)
        );
        return depth > 2 ? keys : [...keys, 'not'];
      }
      if ('any' in obj) {
        // https://github.com/storybookjs/storybook/issues/29816
        return Object.keys(obj).filter((it) => it !== 'any');
      }
      return Object.keys(obj);
    },
    mutate: true,
    intercept: (method) => method !== 'expect',
  }
);

type ModuleMockOptions = {
  spy?: boolean;
};
type ReturnTypeOfModuleMocker = (
  path: string | Promise<unknown>,
  factory?: ModuleMockOptions
) => void;

export const sb: {
  mock: ReturnTypeOfModuleMocker;
} = {
  mock: () => {
    // noop
  },
};

export * from './testing-library';
