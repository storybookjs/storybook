import { ImplicitActionsDuringRendering } from 'storybook/internal/preview-errors';
import type { Renderer } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { PreviewWeb } from 'storybook/preview-api';
import { addons } from 'storybook/preview-api';

import { EVENT_ID } from '../constants.ts';
import type { ActionDisplay, ActionOptions, HandlerFunction } from '../models/index.ts';
import { config } from './configureActions.ts';

type SyntheticEvent = any; // import('react').SyntheticEvent;
const findProto = (obj: unknown, callback: (proto: any) => boolean): Function | null => {
  const proto = Object.getPrototypeOf(obj);

  if (!proto || callback(proto)) {
    return proto;
  }
  return findProto(proto, callback);
};
const isReactSyntheticEvent = (e: unknown): e is SyntheticEvent =>
  Boolean(
    typeof e === 'object' &&
    e &&
    findProto(e, (proto) => /^Synthetic(?:Base)?Event$/.test(proto.constructor.name)) &&
    typeof (e as SyntheticEvent).persist === 'function'
  );
// `window` is one of the few properties readable on a cross-origin Window, and
// anything else (e.g. `constructor`) throws a SecurityError.
const hasWindowView = (target: object): boolean => {
  try {
    if (!('view' in target)) {
      return false;
    }
    const { view } = target;
    return typeof view === 'object' && view !== null && 'window' in view && view.window === view;
  } catch {
    return false;
  }
};

// Sending a real Window over the channel makes the serializer walk `top`/`frames`
// into cross-origin iframes in the manager document and throw a SecurityError.
const stubWindowView = (target: object) => {
  if (hasWindowView(target)) {
    Object.defineProperty(target, 'view', {
      enumerable: Object.getOwnPropertyDescriptor(target, 'view')?.enumerable ?? true,
      configurable: true,
      writable: true,
      value: {},
    });
  }
};

const serializeArg = <T extends object>(a: T) => {
  if (isReactSyntheticEvent(a)) {
    const e: SyntheticEvent = Object.create(
      a.constructor.prototype,
      Object.getOwnPropertyDescriptors(a)
    );
    e.persist();
    stubWindowView(e);

    // React 19 stamps the native event's `view` as a non-configurable accessor,
    // so it is dropped from a copy and the event retained by the spy stays untouched.
    const nativeEventDescriptor = Object.getOwnPropertyDescriptor(e, 'nativeEvent');
    const nativeEvent = nativeEventDescriptor?.value;
    if (typeof nativeEvent === 'object' && nativeEvent !== null) {
      const nativeEventDescriptors = Object.getOwnPropertyDescriptors(nativeEvent);
      delete nativeEventDescriptors.view;
      const nativeEventCopy = Object.create(
        Object.getPrototypeOf(nativeEvent),
        nativeEventDescriptors
      );
      stubWindowView(nativeEventCopy);
      Object.defineProperty(e, 'nativeEvent', { ...nativeEventDescriptor, value: nativeEventCopy });
    }
    return e;
  }
  return a;
};

export function action(name: string, options: ActionOptions = {}): HandlerFunction {
  const actionOptions = {
    ...config,
    ...options,
  };

  const handler = function actionHandler(...args: any[]) {
    if (options.implicit) {
      const preview =
        '__STORYBOOK_PREVIEW__' in global
          ? (global.__STORYBOOK_PREVIEW__ as unknown as PreviewWeb<Renderer>)
          : undefined;
      const storyRenderer = preview?.storyRenders.find(
        (render) => render.phase === 'playing' || render.phase === 'rendering'
      );

      if (storyRenderer) {
        throw new ImplicitActionsDuringRendering({
          phase: storyRenderer.phase!,
          name,
        });
      }
    }

    const channel = addons.getChannel();
    // TODO react native doesn't have the crypto module, we should figure out a better way to generate these ids.
    // pseudo random id, example response lo1e7zm4832bkr7yfl7
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const minDepth = 5; // anything less is really just storybook internals
    const serializedArgs = args.map(serializeArg);
    const normalizedArgs = args.length === 1 ? serializedArgs[0] : serializedArgs;

    const actionDisplayToEmit: ActionDisplay = {
      id,
      count: 0,
      data: { name, args: normalizedArgs },
      options: {
        ...actionOptions,
        maxDepth: minDepth + (actionOptions.depth || 3),
      },
    };
    channel.emit(EVENT_ID, actionDisplayToEmit);
  };
  handler.isAction = true;
  handler.implicit = options.implicit;

  return handler;
}
