import { v4 as uuidv4 } from 'uuid';
import type { PreviewWeb } from 'storybook/internal/preview-api';
import { addons } from 'storybook/internal/preview-api';
import type { Renderer } from 'storybook/internal/types';
import { global } from '@storybook/global';
import { ImplicitActionsDuringRendering } from 'storybook/internal/preview-errors';
import { EVENT_ID } from '../constants';
import type { ActionDisplay, ActionOptions, HandlerFunction } from '../models';
import { config } from './configureActions';

type SyntheticEvent = any; // import('react').SyntheticEvent;
const findProto = (obj: unknown, callback: (proto: any) => boolean): Function | null => {
  const proto = Object.getPrototypeOf(obj);
  if (!proto || callback(proto)) return proto;
  return findProto(proto, callback);
};
const isReactSyntheticEvent = (e: unknown): e is SyntheticEvent =>
  Boolean(
    typeof e === 'object' &&
      e &&
      findProto(e, (proto) => /^Synthetic(?:Base)?Event$/.test(proto.constructor.name)) &&
      typeof (e as SyntheticEvent).persist === 'function'
  );
const serializeArg = <T extends object>(a: T) => {
  if (isReactSyntheticEvent(a)) {
    const e: SyntheticEvent = Object.create(
      a.constructor.prototype,
      Object.getOwnPropertyDescriptors(a)
    );
    e.persist();
    const viewDescriptor = Object.getOwnPropertyDescriptor(e, 'view');
    // don't send the entire window object over.
    const view: unknown = viewDescriptor?.value;
    if (typeof view === 'object' && view?.constructor.name === 'Window') {
      Object.defineProperty(e, 'view', {
        ...viewDescriptor,
        value: Object.create(view.constructor.prototype),
      });
    }
    return e;
  }
  return a;
};

// TODO react native doesn't have the crypto module, we should figure out a better way to generate these ids.
const generateId = () => {
  return typeof crypto === 'object' && typeof crypto.getRandomValues === 'function'
    ? uuidv4()
    : // pseudo random id, example response lo1e7zm4832bkr7yfl7
      Date.now().toString(36) + Math.random().toString(36).substring(2);
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
          ? // eslint-disable-next-line no-underscore-dangle
            (global.__STORYBOOK_PREVIEW__ as PreviewWeb<Renderer>)
          : undefined;
      const storyRenderer = preview?.storyRenders.find(
        (render) => render.phase === 'playing' || render.phase === 'rendering'
      );

      if (storyRenderer) {
        const deprecated = !window?.FEATURES?.disallowImplicitActionsInRenderV8;
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
    // this makes sure that in js environments like react native you can still get an id
    const id = generateId();
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
        allowFunction: actionOptions.allowFunction || false,
      },
    };
    channel.emit(EVENT_ID, actionDisplayToEmit);
  };
  handler.isAction = true;
  handler.implicit = options.implicit;

  return handler;
}
