import type { PartialStoryFn, Renderer } from 'storybook/internal/types';

import { makeDecorator, useEffect } from 'storybook/preview-api';

import { PARAM_KEY } from './constants';
import { actions } from './runtime/actions';

const delegateEventSplitter = /^(\S+)\s*(.*)$/;

const isIE = Element != null && !Element.prototype.matches;
const matchesMethod = isIE ? 'msMatchesSelector' : 'matches';

const hasMatchInAncestry = (element: any, selector: any): boolean => {
  if (element[matchesMethod](selector)) {
    return true;
  }
  const parent = element.parentElement;
  if (!parent) {
    return false;
  }
  return hasMatchInAncestry(parent, selector);
};

const createHandlers = (actionsFn: (...arg: any[]) => object, ...handles: any[]) => {
  const actionsObject = actionsFn(...handles);
  return Object.entries(actionsObject).map(([key, action]) => {
    const [_, eventName, selector] = key.match(delegateEventSplitter) || [];
    return {
      eventName,
      handler: (e: { target: any }) => {
        if (!selector || hasMatchInAncestry(e.target, selector)) {
          action(e);
        }
      },
    };
  });
};

const applyEventHandlers = (actionsFn: any, ...handles: any[]) => {
  const root =
    typeof globalThis.document !== 'undefined' &&
    globalThis.document.getElementById('storybook-root');
  useEffect(() => {
    if (root) {
      const handlers = createHandlers(actionsFn, ...handles);
      handlers.forEach(({ eventName, handler }) => root.addEventListener(eventName, handler));
      return () =>
        handlers.forEach(({ eventName, handler }) => root.removeEventListener(eventName, handler));
    }
    return undefined;
  }, [root, actionsFn, handles]);
};

// This type is basically the same as DecoratorFunction from storybook/internal/types.
// We can not use DecoratorFunction though as the type has to be generic.
// Hard to explain, but you will understand when you try to solve this issue:
// https://github.com/storybookjs/storybook/issues/22384
/** @deprecated Will be removed in Storybook v10 */
export const withActions: <T extends Renderer>(storyFn: PartialStoryFn<T>) => T['storyResult'] =
  makeDecorator({
    name: 'withActions',
    parameterName: PARAM_KEY,
    skipIfNoParametersOrOptions: true,
    wrapper: (getStory, context, { parameters }) => {
      if (parameters?.handles) {
        applyEventHandlers(actions, ...parameters.handles);
      }

      return getStory(context);
    },
  });
