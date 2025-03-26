import type { BoundFunctions } from '@testing-library/dom';
import type { userEvent } from '@testing-library/user-event';

import { instrument } from 'storybook/internal/instrumenter';

import { Assertion } from 'chai';
import { definePreview } from 'storybook/preview-api';

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
    getKeys: (obj: Record<string, unknown>, depth) => {
      const privateApi = ['assert', '__methods', '__flags', '_obj'];
      if (obj.constructor === Assertion) {
        const keys = Object.keys(Object.getPrototypeOf(obj)).filter(
          (it) => !privateApi.includes(it)
        );
        return depth > 2 ? keys : [...keys, 'not'];
      }
      return Object.keys(obj);
    },
    intercept: (method) => method !== 'expect',
  }
);

export * from './testing-library';
