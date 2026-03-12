import * as domTestingLibrary from '@testing-library/dom';
import type { FireFunction, FireObject } from '@testing-library/dom/types/events';
import * as _userEvent from '@testing-library/user-event';

import { once } from 'storybook/internal/client-logger';
import { instrument } from 'storybook/internal/instrumenter';

import { dedent } from 'ts-dedent';
import type { Writable } from 'type-fest';

import type { Promisify, PromisifyObject } from './utils';

type TestingLibraryDom = typeof domTestingLibrary;

const testingLibrary = instrument(
  { ...domTestingLibrary },
  {
    getKeys: (obj) => Object.keys(obj).filter((key) => key !== 'eventWrapper'),
    intercept: (method, path) =>
      path[0] === 'fireEvent' || method.startsWith('find') || method.startsWith('waitFor'),
  }
) as {} as Writable<Omit<TestingLibraryDom, 'fireEvent'>> & {
  fireEvent: Promisify<FireFunction> & PromisifyObject<FireObject>;
};

testingLibrary.screen = new Proxy(testingLibrary.screen, {
  get(target, prop, receiver) {
    if (typeof window !== 'undefined' && globalThis.location?.href?.includes('viewMode=docs')) {
      once.warn(dedent`
        You are using Testing Library's \`screen\` object while the story is rendered in docs mode. This will likely lead to issues, as multiple stories are rendered in the same page and therefore screen will potentially find multiple elements. Use the \`canvas\` utility from the story context instead, which will scope the queries to each story's canvas.

        More info: https://storybook.js.org/docs/writing-tests/interaction-testing?ref=error#querying-the-canvas
      `);
    }
    return Reflect.get(target, prop, receiver);
  },
});

// Configure a better error message that avoids dumping the full document body
// (which includes Storybook's own UI markup) when using `screen` queries.
// When `screen` is used, the container is `document.body`, which would otherwise
// produce hundreds of lines of irrelevant HTML in error messages.
// See: https://github.com/storybookjs/storybook/issues/34118
domTestingLibrary.configure({
  getElementError(message: string | null, container: Element) {
    const prettifiedDOM =
      typeof document !== 'undefined' && container === document.body
        ? null
        : domTestingLibrary.prettyDOM(container);

    // eslint-disable-next-line local-rules/no-uncategorized-errors
    const error = new Error(
      [
        message,
        prettifiedDOM
          ? `Ignored nodes: comments, ${domTestingLibrary.getConfig().defaultIgnore}\n${prettifiedDOM}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    );
    error.name = 'TestingLibraryElementError';
    return error;
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

type _UserEvent = typeof _userEvent;

export interface UserEvent extends _UserEvent {}

export const uninstrumentedUserEvent = _userEvent.userEvent;

export const { userEvent }: { userEvent: UserEvent['userEvent'] } = instrument(
  { userEvent: _userEvent.userEvent },
  { intercept: true, getKeys: (obj) => Object.keys(obj).filter((key) => key !== 'eventWrapper') }
);
