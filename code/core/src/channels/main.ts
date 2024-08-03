import type {
  ChannelArgs,
  ChannelArgsMulti,
  EventsKeyValue,
  ChannelTransport,
  ChannelArgsSingle,
  Listener,
  ChannelEvent,
} from './types';

const isMulti = (args: ChannelArgs): args is ChannelArgsMulti => {
  // @ts-expect-error (we guard against this right here)
  return args.transports !== undefined;
};

const generateRandomId = () => {
  // generates a random 13 character string
  return Math.random().toString(16).slice(2);
};

export class Channel {
  readonly isAsync: boolean;

  private sender = generateRandomId();

  private events: EventsKeyValue = {};

  private data: Record<string, any> = {};

  private readonly transports: ChannelTransport[] = [];

  constructor(input: ChannelArgsMulti);
  constructor(input: ChannelArgsSingle);
  constructor(input: ChannelArgs = {}) {
    this.isAsync = input.async || false;

    if (isMulti(input)) {
      this.transports = input.transports || [];

      this.transports.forEach((t) => {
        t.setHandler((event) => this.handleEvent(event));
      });
    } else {
      this.transports = input.transport ? [input.transport] : [];
    }

    this.transports.forEach((t) => {
      t.setHandler((event) => this.handleEvent(event));
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
      this.transports.forEach((t) => {
        t.send(event, options);
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

  private handleEvent(event: ChannelEvent) {
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
