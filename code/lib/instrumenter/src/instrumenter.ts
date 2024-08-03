/* eslint-disable no-underscore-dangle */
import type { Channel } from 'storybook/internal/channels';
import { addons } from 'storybook/internal/preview-api';
import type { StoryId } from 'storybook/internal/types';
import { once } from 'storybook/internal/client-logger';
import './typings.d.ts';
import {
  FORCE_REMOUNT,
  SET_CURRENT_STORY,
  STORY_RENDER_PHASE_CHANGED,
} from 'storybook/internal/core-events';
import { global } from '@storybook/global';
import { processError } from '@vitest/utils/error';

import type { Call, CallRef, ControlStates, LogItem, Options, State, SyncPayload } from './types';
import { CallStates } from './types';

export const EVENTS = {
  CALL: 'storybook/instrumenter/call',
  SYNC: 'storybook/instrumenter/sync',
  START: 'storybook/instrumenter/start',
  BACK: 'storybook/instrumenter/back',
  GOTO: 'storybook/instrumenter/goto',
  NEXT: 'storybook/instrumenter/next',
  END: 'storybook/instrumenter/end',
};

type PatchedObj<TObj extends Record<string, unknown>> = {
  [Property in keyof TObj]: TObj[Property] & { __originalFn__: TObj[Property] };
};

const controlsDisabled: ControlStates = {
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

const alreadyCompletedException = new Error(
  `This function ran after the play function completed. Did you forget to \`await\` it?`
);

const isObject = (o: unknown): o is object =>
  Object.prototype.toString.call(o) === '[object Object]';
const isModule = (o: unknown): o is NodeModule =>
  Object.prototype.toString.call(o) === '[object Module]';
const isInstrumentable = (o: unknown) => {
  if (!isObject(o) && !isModule(o)) return false;
  if (o.constructor === undefined) return true;
  const proto = o.constructor.prototype;
  if (!isObject(proto)) return false;
  return true;
};

const construct = (obj: any) => {
  try {
    return new obj.constructor();
  } catch (e) {
    return {};
  }
};

const getInitialState = (): State => ({
  renderPhase: undefined,
  isDebugging: false,
  isPlaying: false,
  isLocked: false,
  cursor: 0,
  calls: [],
  shadowCalls: [],
  callRefsByResult: new Map(),
  chainedCallIds: new Set<Call['id']>(),
  ancestors: [],
  playUntil: undefined,
  resolvers: {},
  syncTimeout: undefined,
});

const getRetainedState = (state: State, isDebugging = false) => {
  const calls = (isDebugging ? state.shadowCalls : state.calls).filter((call) => call.retain);
  if (!calls.length) return undefined;
  const callRefsByResult = new Map(
    Array.from(state.callRefsByResult.entries()).filter(([, ref]) => ref.retain)
  );
  return { cursor: calls.length, calls, callRefsByResult };
};

/**
 * This class is not supposed to be used directly. Use the `instrument` function below instead.
 */
export class Instrumenter {
  channel: Channel;

  initialized = false;

  // State is tracked per story to deal with multiple stories on the same canvas (i.e. docs mode)
  state: Record<StoryId, State>;

  constructor() {
    this.channel = addons.getChannel();

    // Restore state from the parent window in case the iframe was reloaded.
    // @ts-expect-error (TS doesn't know about this global variable)
    this.state = global.window?.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ || {};

    // When called from `start`, isDebugging will be true.
    const resetState = ({
      storyId,
      isPlaying = true,
      isDebugging = false,
    }: {
      storyId: StoryId;
      isPlaying?: boolean;
      isDebugging?: boolean;
    }) => {
      const state = this.getState(storyId);
      this.setState(storyId, {
        ...getInitialState(),
        ...getRetainedState(state, isDebugging),
        shadowCalls: isDebugging ? state.shadowCalls : [],
        chainedCallIds: isDebugging ? state.chainedCallIds : new Set<Call['id']>(),
        playUntil: isDebugging ? state.playUntil : undefined,
        isPlaying,
        isDebugging,
      });
      this.sync(storyId);
    };

    // A forceRemount might be triggered for debugging (on `start`), or elsewhere in Storybook.
    this.channel.on(FORCE_REMOUNT, resetState);

    // Start with a clean slate before playing after a remount, and stop debugging when done.
    this.channel.on(STORY_RENDER_PHASE_CHANGED, ({ storyId, newPhase }) => {
      const { isDebugging } = this.getState(storyId);
      this.setState(storyId, { renderPhase: newPhase });
      if (newPhase === 'preparing' && isDebugging) {
        resetState({ storyId });
      }
      if (newPhase === 'playing') {
        resetState({ storyId, isDebugging });
      }
      if (newPhase === 'played') {
        this.setState(storyId, {
          isLocked: false,
          isPlaying: false,
          isDebugging: false,
        });
      }
      if (newPhase === 'errored') {
        this.setState(storyId, {
          isLocked: false,
          isPlaying: false,
        });
      }
    });

    // Trash non-retained state and clear the log when switching stories, but not on initial boot.
    this.channel.on(SET_CURRENT_STORY, () => {
      if (this.initialized) this.cleanup();
      else this.initialized = true;
    });

    const start = ({ storyId, playUntil }: { storyId: string; playUntil?: Call['id'] }) => {
      if (!this.getState(storyId).isDebugging) {
        // Move everything into shadowCalls (a "carbon copy") and mark them as "waiting", so we keep
        // a record of the original calls which haven't yet been executed while stepping through.
        this.setState(storyId, ({ calls }) => ({
          calls: [],
          shadowCalls: calls.map((call) => ({ ...call, status: CallStates.WAITING })),
          isDebugging: true,
        }));
      }

      const log = this.getLog(storyId);
      this.setState(storyId, ({ shadowCalls }) => {
        if (playUntil || !log.length) return { playUntil };
        const firstRowIndex = shadowCalls.findIndex((call) => call.id === log[0].callId);
        return {
          playUntil: shadowCalls
            .slice(0, firstRowIndex)
            .filter((call) => call.interceptable && !call.ancestors.length)
            .slice(-1)[0]?.id,
        };
      });

      // Force remount may trigger a page reload if the play function can't be aborted.
      this.channel.emit(FORCE_REMOUNT, { storyId, isDebugging: true });
    };

    const back = ({ storyId }: { storyId: string }) => {
      const log = this.getLog(storyId).filter((call) => !call.ancestors.length);
      const last = log.reduceRight((res, item, index) => {
        if (res >= 0 || item.status === CallStates.WAITING) return res;
        return index;
      }, -1);
      start({ storyId, playUntil: log[last - 1]?.callId });
    };

    const goto = ({ storyId, callId }: { storyId: string; callId: Call['id'] }) => {
      const { calls, shadowCalls, resolvers } = this.getState(storyId);
      const call = calls.find(({ id }) => id === callId);
      const shadowCall = shadowCalls.find(({ id }) => id === callId);
      if (!call && shadowCall && Object.values(resolvers).length > 0) {
        const nextId = this.getLog(storyId).find((c) => c.status === CallStates.WAITING)?.callId;
        if (shadowCall.id !== nextId) this.setState(storyId, { playUntil: shadowCall.id });
        Object.values(resolvers).forEach((resolve) => resolve());
      } else {
        start({ storyId, playUntil: callId });
      }
    };

    const next = ({ storyId }: { storyId: string }) => {
      const { resolvers } = this.getState(storyId);
      if (Object.values(resolvers).length > 0) {
        Object.values(resolvers).forEach((resolve) => resolve());
      } else {
        const nextId = this.getLog(storyId).find((c) => c.status === CallStates.WAITING)?.callId;
        if (nextId) start({ storyId, playUntil: nextId });
        else end({ storyId });
      }
    };

    const end = ({ storyId }: { storyId: string }) => {
      this.setState(storyId, { playUntil: undefined, isDebugging: false });
      Object.values(this.getState(storyId).resolvers).forEach((resolve) => resolve());
    };

    this.channel.on(EVENTS.START, start);
    this.channel.on(EVENTS.BACK, back);
    this.channel.on(EVENTS.GOTO, goto);
    this.channel.on(EVENTS.NEXT, next);
    this.channel.on(EVENTS.END, end);
  }

  getState(storyId: StoryId) {
    return this.state[storyId] || getInitialState();
  }

  setState(storyId: StoryId, update: Partial<State> | ((state: State) => Partial<State>)) {
    const state = this.getState(storyId);
    const patch = typeof update === 'function' ? update(state) : update;
    this.state = { ...this.state, [storyId]: { ...state, ...patch } };
    // Track state on the parent window so we can reload the iframe without losing state.
    if (global.window?.parent) {
      // @ts-expect-error fix this later in d.ts file
      global.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = this.state;
    }
  }

  cleanup() {
    // Reset stories with retained state to their initial state, and drop the rest.
    this.state = Object.entries(this.state).reduce(
      (acc, [storyId, state]) => {
        const retainedState = getRetainedState(state);
        if (!retainedState) return acc;
        acc[storyId] = Object.assign(getInitialState(), retainedState);
        return acc;
      },
      {} as Record<StoryId, State>
    );
    const payload: SyncPayload = { controlStates: controlsDisabled, logItems: [] };
    this.channel.emit(EVENTS.SYNC, payload);
    if (global.window?.parent) {
      // @ts-expect-error fix this later in d.ts file
      global.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = this.state;
    }
  }

  getLog(storyId: string): LogItem[] {
    const { calls, shadowCalls } = this.getState(storyId);
    const merged = [...shadowCalls];
    calls.forEach((call, index) => {
      merged[index] = call;
    });

    const seen = new Set();
    return merged.reduceRight<LogItem[]>((acc, call) => {
      call.args.forEach((arg) => {
        if (arg?.__callId__) {
          seen.add(arg.__callId__);
        }
      });
      call.path.forEach((node) => {
        if ((node as CallRef).__callId__) {
          seen.add((node as CallRef).__callId__);
        }
      });
      if ((call.interceptable || call.exception) && !seen.has(call.id)) {
        acc.unshift({ callId: call.id, status: call.status, ancestors: call.ancestors });
        seen.add(call.id);
      }
      return acc;
    }, []);
  }

  // Traverses the object structure to recursively patch all function properties.
  // Returns the original object, or a new object with the same constructor,
  // depending on whether it should mutate.
  instrument<TObj extends Record<string, unknown>>(
    obj: TObj,
    options: Options,
    depth = 0
  ): PatchedObj<TObj> {
    if (!isInstrumentable(obj)) return obj as PatchedObj<TObj>;

    const { mutate = false, path = [] } = options;

    const keys = options.getKeys ? options.getKeys(obj, depth) : Object.keys(obj);
    depth += 1;
    return keys.reduce(
      (acc, key) => {
        const descriptor = getPropertyDescriptor(obj, key);
        if (typeof descriptor?.get === 'function') {
          const getter = () => descriptor?.get?.bind(obj)?.();
          Object.defineProperty(acc, key, {
            get: () => {
              return this.instrument(getter(), { ...options, path: path.concat(key) }, depth);
            },
          });
          return acc;
        }

        const value = (obj as Record<string, any>)[key];

        // Nothing to patch, but might be instrumentable, so we recurse
        if (typeof value !== 'function') {
          acc[key] = this.instrument(value, { ...options, path: path.concat(key) }, depth);
          return acc;
        }

        // Already patched, so we pass through unchanged
        if ('__originalFn__' in value && typeof value.__originalFn__ === 'function') {
          acc[key] = value;
          return acc;
        }

        // Patch the function and mark it "patched" by adding a reference to the original function
        acc[key] = (...args: any[]) => this.track(key, value, obj, args, options);
        acc[key].__originalFn__ = value;

        // Reuse the original name as the patched function's name
        Object.defineProperty(acc[key], 'name', { value: key, writable: false });

        // Deal with functions that also act like an object
        if (Object.keys(value).length > 0) {
          Object.assign(
            acc[key],
            this.instrument({ ...value }, { ...options, path: path.concat(key) }, depth)
          );
        }

        return acc;
      },
      mutate ? obj : construct(obj)
    );
  }

  // Monkey patch an object method to record calls.
  // Returns a function that invokes the original function, records the invocation ("call") and
  // returns the original result.
  track(
    method: string,
    fn: Function,
    object: Record<string, unknown>,
    args: any[],
    options: Options
  ) {
    const storyId: StoryId =
      args?.[0]?.__storyId__ || global.__STORYBOOK_PREVIEW__?.selectionStore?.selection?.storyId;
    const { cursor, ancestors } = this.getState(storyId);
    this.setState(storyId, { cursor: cursor + 1 });
    const id = `${ancestors.slice(-1)[0] || storyId} [${cursor}] ${method}`;
    const { path = [], intercept = false, retain = false } = options;
    const interceptable = typeof intercept === 'function' ? intercept(method, path) : intercept;
    const call = { id, cursor, storyId, ancestors, path, method, args, interceptable, retain };
    const interceptOrInvoke = interceptable && !ancestors.length ? this.intercept : this.invoke;
    const result = interceptOrInvoke.call(this, fn, object, call, options);
    return this.instrument(result, { ...options, mutate: true, path: [{ __callId__: call.id }] });
  }

  intercept(fn: Function, object: Record<string, unknown>, call: Call, options: Options) {
    const { chainedCallIds, isDebugging, playUntil } = this.getState(call.storyId);

    // For a "jump to step" action, continue playing until we hit a call by that ID.
    // For chained calls, we can only return a Promise for the last call in the chain.
    const isChainedUpon = chainedCallIds.has(call.id);
    if (!isDebugging || isChainedUpon || playUntil) {
      if (playUntil === call.id) {
        this.setState(call.storyId, { playUntil: undefined });
      }
      return this.invoke(fn, object, call, options);
    }

    // Instead of invoking the function, defer the function call until we continue playing.
    return new Promise((resolve) => {
      this.setState(call.storyId, ({ resolvers }) => ({
        isLocked: false,
        resolvers: { ...resolvers, [call.id]: resolve },
      }));
    }).then(() => {
      this.setState(call.storyId, (state) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { [call.id]: _, ...resolvers } = state.resolvers;
        return { isLocked: true, resolvers };
      });
      return this.invoke(fn, object, call, options);
    });
  }

  invoke(fn: Function, object: Record<string, unknown>, call: Call, options: Options) {
    const { callRefsByResult, renderPhase } = this.getState(call.storyId);

    // TODO This function should not needed anymore, as the channel already serializes values with telejson
    // Possibly we need to add HTMLElement support to telejson though
    // Keeping this function here, as removing it means we need to refactor the deserializing that happens in addon-interactions
    const maximumDepth = 25; // mimicks the max depth of telejson
    const serializeValues = (value: any, depth: number, seen: unknown[]): any => {
      if (seen.includes(value)) return '[Circular]';
      seen = [...seen, value];

      if (depth > maximumDepth) return '...';

      if (callRefsByResult.has(value)) {
        return callRefsByResult.get(value);
      }
      if (value instanceof Array) {
        return value.map((it) => serializeValues(it, ++depth, seen));
      }
      if (value instanceof Date) {
        return { __date__: { value: value.toISOString() } };
      }
      if (value instanceof Error) {
        const { name, message, stack } = value;
        return { __error__: { name, message, stack } };
      }
      if (value instanceof RegExp) {
        const { flags, source } = value;
        return { __regexp__: { flags, source } };
      }
      if (value instanceof global.window?.HTMLElement) {
        const { prefix, localName, id, classList, innerText } = value;
        const classNames = Array.from(classList);
        return { __element__: { prefix, localName, id, classNames, innerText } };
      }
      if (typeof value === 'function') {
        return {
          __function__: { name: 'getMockName' in value ? value.getMockName() : value.name },
        };
      }
      if (typeof value === 'symbol') {
        return { __symbol__: { description: value.description } };
      }
      if (
        typeof value === 'object' &&
        value?.constructor?.name &&
        value?.constructor?.name !== 'Object'
      ) {
        return { __class__: { name: value.constructor.name } };
      }
      if (Object.prototype.toString.call(value) === '[object Object]') {
        return Object.fromEntries(
          Object.entries(value).map(([key, val]) => [key, serializeValues(val, ++depth, seen)])
        );
      }
      return value;
    };

    const info: Call = {
      ...call,
      args: call.args.map((arg) => serializeValues(arg, 0, [])),
    };

    // Mark any ancestor calls as "chained upon" so we won't attempt to defer it later.
    call.path.forEach((ref: any) => {
      if (ref?.__callId__) {
        this.setState(call.storyId, ({ chainedCallIds }) => ({
          chainedCallIds: new Set(Array.from(chainedCallIds).concat(ref.__callId__)),
        }));
      }
    });

    const handleException = (e: any) => {
      if (e instanceof Error) {
        const { name, message, stack, callId = call.id } = e as Error & { callId: Call['id'] };

        // This will calculate the diff for chai errors
        const {
          showDiff = undefined,
          diff = undefined,
          actual = undefined,
          expected = undefined,
        } = e.name === 'AssertionError' ? processError(e) : e;

        const exception = { name, message, stack, callId, showDiff, diff, actual, expected };
        this.update({ ...info, status: CallStates.ERROR, exception });

        // Always track errors to their originating call.
        this.setState(call.storyId, (state) => ({
          callRefsByResult: new Map([
            ...Array.from(state.callRefsByResult.entries()),
            [e, { __callId__: call.id, retain: call.retain }],
          ]),
        }));

        // Exceptions inside callbacks should bubble up to the parent call.
        if (call.ancestors.length) {
          if (!Object.prototype.hasOwnProperty.call(e, 'callId')) {
            Object.defineProperty(e, 'callId', { value: call.id });
          }
          throw e;
        }
      }
      throw e;
    };

    try {
      if (renderPhase === 'played' && !call.retain) {
        throw alreadyCompletedException;
      }

      // Some libraries override function args through the `getArgs` option.
      const actualArgs = options.getArgs
        ? options.getArgs(call, this.getState(call.storyId))
        : call.args;

      // Wrap any callback functions to provide a way to access their "parent" call.
      // This is picked up in the `track` function and used for call metadata.
      const finalArgs = actualArgs.map((arg: any) => {
        // We only want to wrap plain functions, not objects.
        if (typeof arg !== 'function' || Object.keys(arg).length) return arg;

        return (...args: any) => {
          // Set the cursor and ancestors for calls that happen inside the callback.
          const { cursor, ancestors } = this.getState(call.storyId);
          this.setState(call.storyId, { cursor: 0, ancestors: [...ancestors, call.id] });
          const restore = () => this.setState(call.storyId, { cursor, ancestors });

          // Invoke the actual callback function, taking care to reset the cursor and ancestors
          // to their original values before we entered the callback, once the callback completes.
          let willRestore = false;
          try {
            const res = arg(...args);
            if (res instanceof Promise) {
              willRestore = true; // We need to wait for the promise to finish before restoring
              return res.finally(restore);
            }
            return res;
          } finally {
            if (!willRestore) restore();
          }
        };
      });

      const result = fn.apply(object, finalArgs);

      // Track the result so we can trace later uses of it back to the originating call.
      // Primitive results (undefined, null, boolean, string, number, BigInt) are ignored.
      if (result && ['object', 'function', 'symbol'].includes(typeof result)) {
        this.setState(call.storyId, (state) => ({
          callRefsByResult: new Map([
            ...Array.from(state.callRefsByResult.entries()),
            [result, { __callId__: call.id, retain: call.retain }],
          ]),
        }));
      }

      this.update({
        ...info,
        status: result instanceof Promise ? CallStates.ACTIVE : CallStates.DONE,
      });

      if (result instanceof Promise) {
        return result.then((value) => {
          this.update({ ...info, status: CallStates.DONE });
          return value;
        }, handleException);
      }

      return result;
    } catch (e) {
      return handleException(e);
    }
  }

  // Sends the call info to the manager and synchronizes the log.
  update(call: Call) {
    this.channel.emit(EVENTS.CALL, call);
    this.setState(call.storyId, ({ calls }) => {
      // Omit earlier calls for the same ID, which may have been superseded by a later invocation.
      // This typically happens when calls are part of a callback which runs multiple times.
      const callsById = calls
        .concat(call)
        .reduce<Record<Call['id'], Call>>((a, c) => Object.assign(a, { [c.id]: c }), {});
      return {
        // Calls are sorted to ensure parent calls always come before calls in their callback.
        calls: Object.values(callsById).sort((a, b) =>
          a.id.localeCompare(b.id, undefined, { numeric: true })
        ),
      };
    });
    this.sync(call.storyId);
  }

  // Builds a log of interceptable calls and control states and sends it to the manager.
  // Uses a 0ms debounce because this might get called many times in one tick.
  sync(storyId: string) {
    const synchronize = () => {
      const { isLocked, isPlaying } = this.getState(storyId);
      const logItems: LogItem[] = this.getLog(storyId);
      const pausedAt = logItems
        .filter(({ ancestors }) => !ancestors.length)
        .find((item) => item.status === CallStates.WAITING)?.callId;

      const hasActive = logItems.some((item) => item.status === CallStates.ACTIVE);
      if (isLocked || hasActive || logItems.length === 0) {
        const payload: SyncPayload = { controlStates: controlsDisabled, logItems };
        this.channel.emit(EVENTS.SYNC, payload);
        return;
      }

      const hasPrevious = logItems.some(
        (item) => item.status === CallStates.DONE || item.status === CallStates.ERROR
      );
      const controlStates: ControlStates = {
        start: hasPrevious,
        back: hasPrevious,
        goto: true,
        next: isPlaying,
        end: isPlaying,
      };

      const payload: SyncPayload = { controlStates, logItems, pausedAt };
      this.channel.emit(EVENTS.SYNC, payload);
    };

    this.setState(storyId, ({ syncTimeout }) => {
      clearTimeout(syncTimeout);
      return { syncTimeout: setTimeout(synchronize, 0) };
    });
  }
}

/**
 * Instruments an object or module by traversing its properties, patching any functions (methods)
 * to enable debugging. Patched functions will emit a `call` event when invoked.
 * When intercept = true, patched functions will return a Promise when the debugger stops before
 * this function. As such, "interceptable" functions will have to be `await`-ed.
 */
export function instrument<TObj extends Record<string, any>>(
  obj: TObj,
  options: Options = {}
): TObj {
  try {
    let forceInstrument = false;
    let skipInstrument = false;

    if (global.window?.location?.search?.includes('instrument=true')) {
      forceInstrument = true;
    } else if (global.window?.location?.search?.includes('instrument=false')) {
      skipInstrument = true;
    }

    // Don't do any instrumentation if not loaded in an iframe unless it's forced - instrumentation can also be skipped.
    if ((global.window?.parent === global.window && !forceInstrument) || skipInstrument) {
      return obj;
    }

    // Only create an instance if we don't have one (singleton) yet.
    if (global.window && !global.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__) {
      global.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ = new Instrumenter();
    }

    const instrumenter: Instrumenter = global.window?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__;
    return instrumenter.instrument(obj, options);
  } catch (e) {
    // Access to the parent window might fail due to CORS restrictions.
    once.warn(e);
    return obj;
  }
}

function getPropertyDescriptor<T>(obj: T, propName: keyof T) {
  let target = obj;
  while (target != null) {
    const descriptor = Object.getOwnPropertyDescriptor(target, propName);
    if (descriptor) {
      return descriptor;
    }
    target = Object.getPrototypeOf(target);
  }
  return undefined;
}
