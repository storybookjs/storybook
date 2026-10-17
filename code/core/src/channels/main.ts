import { STORY_ARGS_UPDATED, STORY_PREPARED, UPDATE_STORY_ARGS } from '../core-events/index.ts';
import { serializeArgFunctions } from '../shared/utils/function-args.ts';

import type {
  ChannelArgs,
  ChannelArgsMulti,
  ChannelArgsSingle,
  ChannelEvent,
  ChannelLike,
  ChannelTransport,
  EventsKeyValue,
  Listener,
} from './types.ts';
const transportedValues = new WeakSet<object>();

const argFieldsByEvent: Record<string, string[]> = {
  [STORY_PREPARED]: ['args', 'initialArgs'],
  [STORY_ARGS_UPDATED]: ['args'],
  [UPDATE_STORY_ARGS]: ['updatedArgs'],
};

const serializeEventArgs = (event: ChannelEvent): ChannelEvent => {
  const fields = argFieldsByEvent[event.type];
  const payload = event.args[0];
  if (!fields || payload === null || typeof payload !== 'object') {
    return event;
  }

  const serialized = { ...payload };
  for (const field of fields) {
    serialized[field] = serializeArgFunctions(payload[field]);
  }
  return { ...event, args: [serialized, ...event.args.slice(1)] };
};

export const isTransportedChannelValue = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && transportedValues.has(value);

const isMulti = (args: ChannelArgs): args is ChannelArgsMulti => {
  // @ts-expect-error (we guard against this right here)
  return args.transports !== undefined;
};

const generateRandomId = () => {
  // generates a random 13 character string
  return Math.random().toString(16).slice(2);
};

export class Channel implements ChannelLike {
  readonly isAsync: boolean;

  private sender = generateRandomId();

  private events: EventsKeyValue = {};

  private data: Record<string, any> = {};

  private readonly transports: ChannelTransport[] = [];

  constructor(input: ChannelArgsMulti);
  constructor(input: ChannelArgsSingle);
  constructor(input: ChannelArgs = {}) {
    this.isAsync = input.async || false;

    this.transports = isMulti(input)
      ? input.transports || []
      : input.transport
        ? [input.transport]
        : [];

    this.transports.forEach((transport) => {
      transport.setHandler((event) => this.handleEvent(event, true));
    });
  }

  get hasTransport() {
    return this.transports.length > 0;
  }

  addListener(eventName: string, listener: Listener) {
    this.events[eventName] = this.events[eventName] || [];
    this.events[eventName].push(listener);
  }

  emit(eventName: string, ...args: any) {
    const event: ChannelEvent = { type: eventName, args, from: this.sender };
    let options = {};
    if (args.length >= 1 && args[0] && args[0].options) {
      options = args[0].options;
    }

    const handler = () => {
      const transportedEvent = serializeEventArgs(event);
      this.transports.forEach((transport) => {
        transport.send(transportedEvent, options);
      });
      this.handleEvent(event);
    };

    if (this.isAsync) {
      // todo I'm not sure how to test this
      setImmediate(handler);
    } else {
      handler();
    }
  }

  last(eventName: string) {
    return this.data[eventName];
  }

  eventNames() {
    return Object.keys(this.events);
  }

  listenerCount(eventName: string) {
    const listeners = this.listeners(eventName);
    return listeners ? listeners.length : 0;
  }

  listeners(eventName: string): Listener[] | undefined {
    const listeners = this.events[eventName];
    return listeners || undefined;
  }

  once(eventName: string, listener: Listener) {
    const onceListener: Listener = this.onceListener(eventName, listener);
    this.addListener(eventName, onceListener);
  }

  removeAllListeners(eventName?: string) {
    if (!eventName) {
      this.events = {};
    } else if (this.events[eventName]) {
      delete this.events[eventName];
    }
  }

  removeListener(eventName: string, listener: Listener) {
    const listeners = this.listeners(eventName);
    if (listeners) {
      this.events[eventName] = listeners.filter((l) => l !== listener);
    }
  }

  on(eventName: string, listener: Listener) {
    this.addListener(eventName, listener);
  }

  off(eventName: string, listener: Listener) {
    this.removeListener(eventName, listener);
  }

  /**
   * Deliver an event to local listeners without sending it to this channel's transports.
   */
  receive(event: ChannelEvent) {
    this.handleEvent(event, true);
  }

  private handleEvent(event: ChannelEvent, transported = false) {
    if (transported) {
      transportedValues.add(event);
      event.args?.forEach((value) => {
        if (value !== null && typeof value === 'object') {
          transportedValues.add(value);
        }
      });
    }
    const listeners = this.listeners(event.type);
    if (listeners && listeners.length) {
      listeners.forEach((fn) => {
        fn.apply(event, event.args);
      });
    }
    this.data[event.type] = event.args;
  }

  private onceListener(eventName: string, listener: Listener) {
    const onceListener: Listener = (...args: any[]) => {
      this.removeListener(eventName, onceListener);
      return listener(...args);
    };
    return onceListener;
  }
}
