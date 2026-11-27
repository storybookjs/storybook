import { ImplicitActionsDuringRendering } from 'storybook/internal/preview-errors';
import type { Renderer } from 'storybook/internal/types';

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
const isWindow = (value: unknown): value is Window =>
  typeof value === 'object' && value !== null && value.constructor?.name === 'Window';

// Drop Window references so channel serialization cannot reach `__STORYBOOK_STORY_STORE__`.
const detachWindow = (value: Window) => Object.create(value.constructor.prototype);

const serializeEvent = (a: unknown): unknown => {
  if (!isReactSyntheticEvent(a)) {
    return a;
  }
  const e: SyntheticEvent = Object.create(
    Object.getPrototypeOf(a),
    Object.getOwnPropertyDescriptors(a)
  );
  e.persist();
  if (isWindow(e.view)) {
    Object.defineProperty(e, 'view', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: detachWindow(e.view),
    });
  }
  if (e.nativeEvent && isWindow(e.nativeEvent.view)) {
    // nativeEvent fields are prototype getters — do not spread; replace view only.
    const nativeEvent = e.nativeEvent;
    e.nativeEvent = new Proxy(nativeEvent, {
      get(target, prop) {
        if (prop === 'view') {
          return detachWindow(target.view);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }
  return e;
};

// loaders.ts calls `action(name)(args)` with the mock args array; unwrap one level only.
const serializeArg = (a: unknown): unknown =>
  Array.isArray(a) ? a.map(serializeEvent) : serializeEvent(a);

export function action(name: string, options: ActionOptions = {}): HandlerFunction {
  const actionOptions = {
    ...config,
    ...options,
  };

  const handler = function actionHandler(...args: any[]) {
    if (options.implicit) {
      const preview =
        '__STORYBOOK_PREVIEW__' in globalThis
          ? (globalThis.__STORYBOOK_PREVIEW__ as unknown as PreviewWeb<Renderer>)
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
    const normalizedArgs = args.length > 1 ? serializedArgs : serializedArgs[0];

    const actionDisplayToEmit: ActionDisplay = {
      id,
      count: 0,
      data: { name, args: normalizedArgs as any },
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
