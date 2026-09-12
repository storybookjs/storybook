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
const isWindowObject = (value: unknown): value is Window => {
  try {
    // `window.window === window` and the `window` property is one of the few
    // allowed to be read on cross-origin Window objects, so this also detects
    // windows we cannot inspect any further.
    return typeof value === 'object' && value !== null && (value as Window).window === value;
  } catch {
    return true;
  }
};

// Replaces a property pointing to a Window with an empty stub: sending a real
// Window over the channel makes the serializer walk `top`/`frames` into any
// cross-origin iframes in the manager document and throw a SecurityError.
const stubWindowProp = (target: Record<string, unknown>, prop: string) => {
  let value: unknown;
  try {
    value = target[prop];
  } catch {
    return;
  }

  if (isWindowObject(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, prop);
    Object.defineProperty(target, prop, {
      enumerable: descriptor?.enumerable ?? true,
      configurable: true,
      writable: true,
      value: Object.create(value.constructor.prototype),
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
    // don't send the entire window object over.
    stubWindowProp(e, 'view');

    // the native event's `view` exposes the same Window (as a non-configurable
    // accessor in React 19); stub it on a copy so the event retained by the spy
    // is untouched
    const nativeEventDescriptor = Object.getOwnPropertyDescriptor(e, 'nativeEvent');
    const nativeEvent: unknown =
      nativeEventDescriptor && 'value' in nativeEventDescriptor
        ? nativeEventDescriptor.value
        : undefined;
    if (typeof nativeEvent === 'object' && nativeEvent) {
      const nativeEventDescriptors = Object.getOwnPropertyDescriptors(nativeEvent);
      // `view` may be a non-configurable accessor, so it can't be redefined on the copy
      delete nativeEventDescriptors.view;
      const nativeEventCopy = Object.create(
        Object.getPrototypeOf(nativeEvent),
        nativeEventDescriptors
      );
      stubWindowProp(nativeEventCopy, 'view');
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
        const deprecated = !globalThis?.FEATURES?.disallowImplicitActionsInRenderV8;
        const error = new ImplicitActionsDuringRendering({
          phase: storyRenderer.phase!,
          name,
          deprecated,
        });
        if (deprecated) {
          console.warn(error);
        } else {
          throw error;
        }
      }
    }

    const channel = addons.getChannel();
    // TODO react native doesn't have the crypto module, we should figure out a better way to generate these ids.
    // pseudo random id, example response lo1e7zm4832bkr7yfl7
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const minDepth = 5; // anything less is really just storybook internals
    const serializedArgs = args.map(serializeArg);
    const normalizedArgs = args.length > 1 ? serializedArgs : serializedArgs[0];

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
