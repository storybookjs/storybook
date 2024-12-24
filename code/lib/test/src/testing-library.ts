/* eslint-disable @typescript-eslint/ban-types */
import * as domTestingLibrary from '@testing-library/dom';
import type { FireFunction, FireObject } from '@testing-library/dom/types/events';
import _userEvent from '@testing-library/user-event';

import { once } from 'storybook/internal/client-logger';

import { instrument } from '@storybook/instrumenter';

import dedent from 'ts-dedent';
import type { Writable } from 'type-fest';

import type { Promisify, PromisifyObject } from './utils';

type TestingLibraryDom = typeof domTestingLibrary;

const testingLibrary = instrument(
  { ...domTestingLibrary },
  {
    intercept: (method, path) =>
      path[0] === 'fireEvent' || method.startsWith('find') || method.startsWith('waitFor'),
  }
) as {} as Writable<Omit<TestingLibraryDom, 'fireEvent'>> & {
  fireEvent: Promisify<FireFunction> & PromisifyObject<FireObject>;
};

testingLibrary.screen = new Proxy(testingLibrary.screen, {
  get(target, prop, receiver) {
    once.warn(dedent`
          You are using Testing Library's \`screen\` object. Use \`within(canvasElement)\` instead.
          More info: https://storybook.js.org/docs/essentials/interactions
        `);
    return Reflect.get(target, prop, receiver);
  },
});

export const {
  buildQueries,
  configure,
  createEvent,
  fireEvent,
  findAllByAltText,
  findAllByDisplayValue,
  findAllByLabelText,
  findAllByPlaceholderText,
  findAllByRole,
  findAllByTestId,
  findAllByText,
  findAllByTitle,
  findByAltText,
  findByDisplayValue,
  findByLabelText,
  findByPlaceholderText,
  findByRole,
  findByTestId,
  findByText,
  findByTitle,
  getAllByAltText,
  getAllByDisplayValue,
  getAllByLabelText,
  getAllByPlaceholderText,
  getAllByRole,
  getAllByTestId,
  getAllByText,
  getAllByTitle,
  getByAltText,
  getByDisplayValue,
  getByLabelText,
  getByPlaceholderText,
  getByRole,
  getByTestId,
  getByText,
  getByTitle,
  getConfig,
  getDefaultNormalizer,
  getElementError,
  getNodeText,
  getQueriesForElement,
  getRoles,
  getSuggestedQuery,
  isInaccessible,
  logDOM,
  logRoles,
  prettyDOM,
  queries,
  queryAllByAltText,
  queryAllByAttribute,
  queryAllByDisplayValue,
  queryAllByLabelText,
  queryAllByPlaceholderText,
  queryAllByRole,
  queryAllByTestId,
  queryAllByText,
  queryAllByTitle,
  queryByAltText,
  queryByAttribute,
  queryByDisplayValue,
  queryByLabelText,
  queryByPlaceholderText,
  queryByRole,
  queryByTestId,
  queryByText,
  queryByTitle,
  queryHelpers,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  prettyFormat,
} = testingLibrary;

// This lines below are to prevent tsup doing stupid (not working) inline stuff, see:
// https://github.com/storybookjs/storybook/issues/25258
// eslint-disable-next-line @typescript-eslint/naming-convention
type _UserEvent = typeof _userEvent;

export interface UserEvent extends _UserEvent {}

export const { userEvent }: { userEvent: UserEvent } = instrument(
  { userEvent: _userEvent },
  { intercept: true }
);
