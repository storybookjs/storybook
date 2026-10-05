/// <reference types="chai" preserve="true" />

import type { userEvent } from '@testing-library/user-event';

import { instrument } from 'storybook/internal/instrumenter';

import * as chai from 'chai';

import { expect as rawExpect } from './expect.ts';

export * from './spy.ts';
export type { Assertion, Expect } from './expect.ts';

export type UserEventObject = ReturnType<typeof userEvent.setup>;

const chaiAssertionPrivateApi = ['assert', '__methods', '__flags', '_obj'];

function getChaiAssertionKeys(obj: object, depth: number) {
  const keys = Object.keys(Object.getPrototypeOf(obj)).filter(
    (key) => !chaiAssertionPrivateApi.includes(key)
  );
  return [...keys, ...['not'].slice(depth / 3)];
}

function getObjectKeys(obj: object) {
  const keys = Object.keys(obj);
  return keys.filter((key) => key !== 'any');
}

function getKeys(obj: object, depth: number) {
  if ('constructor' in obj && obj.constructor === chai.Assertion) {
    return getChaiAssertionKeys(obj, depth);
  }
  return getObjectKeys(obj);
}

export const { expect } = instrument(
  { expect: rawExpect },
  {
    getKeys,
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

export * from './testing-library.ts';
