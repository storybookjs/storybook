import { describe, beforeEach, it, expect, vi } from 'vitest';
import type { ChannelTransport, Listener } from '.';
import { Channel, WebsocketTransport } from '.';

vi.useFakeTimers();

const MockedWebsocket = vi.hoisted(() => {
  const ref = { current: undefined as unknown as InstanceType<typeof MyMockedWebsocket> };
  class MyMockedWebsocket {
    onopen: () => void;

    onmessage: (event: { data: string }) => void;

    onerror: (e: any) => void;

    onclose: () => void;

    constructor(url: string) {
      this.onopen = vi.fn();
      this.onmessage = vi.fn();
      this.onerror = vi.fn();
      this.onclose = vi.fn();

      ref.current = this;
    }

    send(data: string) {
      this.onmessage({ data });
    }
  }
  return { MyMockedWebsocket, ref };
});

vi.mock('@storybook/global', () => ({
  global: {
    ...global,
    WebSocket: MockedWebsocket.MyMockedWebsocket,
  },
}));

describe('Channel', () => {
  let transport: ChannelTransport;
  let channel: Channel;

  beforeEach(() => {
    transport = { setHandler: vi.fn(), send: vi.fn() };
    channel = new Channel({ transport });
  });

  describe('constructor', () => {
    it('should set the handler if handler is preset', () => {
      channel = new Channel({ transport });
      expect(transport.setHandler).toHaveBeenCalled();
    });

    it('should not set transport if not passed as an argument', () => {
      channel = new Channel({});
      expect(channel.hasTransport).toBeFalsy();
    });

    it('should set transport if passed as an argument', () => {
      channel = new Channel({ transport });
      expect(channel.hasTransport).toBeTruthy();
    });

    it('should set isAsync to false as default value', () => {
      channel = new Channel({});
      expect(channel.isAsync).toBeFalsy();
    });

    it('should set isAsync to true if passed as an argument', () => {
      channel = new Channel({ async: true });
      expect(channel.isAsync).toBeTruthy();
    });
  });

  describe('method:addListener', () => {
    it('should create one listener', () => {
      const eventName = 'event1';

      channel.addListener(eventName, vi.fn());
      expect(channel.listeners(eventName)?.length).toBe(1);
    });
  });

  describe('method:on', () => {
    it('should do the same as addListener', () => {
      const eventName = 'event1';

      channel.on(eventName, vi.fn());
      expect(channel.listeners(eventName)?.length).toBe(1);
    });
  });

  describe('method:off', () => {
    it('should remove listeners', () => {
      const eventName = 'event1';
      const fn = vi.fn();

      channel.on(eventName, fn);
      expect(channel.listeners(eventName)?.length).toBe(1);
      channel.off(eventName, fn);
      expect(channel.listeners(eventName)?.length).toBe(0);
    });
  });

  describe('method:emit', () => {
    it('should execute the callback fn of a listener', () => {
      const eventName = 'event1';
      const listenerInputData = ['string1', 'string2', 'string3'];
      let listenerOutputData: string[] | null = null;
      const mockListener: Listener = (data) => {
        listenerOutputData = data;
      };

      channel.addListener(eventName, mockListener);
      channel.emit(eventName, listenerInputData);
      expect(listenerOutputData).toBe(listenerInputData);
    });

    it('should be callable with a spread operator as event arguments', () => {
      const eventName = 'event1';
      const listenerInputData = ['string1', 'string2', 'string3'];
      let listenerOutputData: string[] | null = null;

      channel.addListener(eventName, (...data) => {
        listenerOutputData = data;
      });
      channel.emit(eventName, ...listenerInputData);
      expect(listenerOutputData).toEqual(listenerInputData);
    });

    it('should be callable with options on the event', () => {
      const eventName = 'event1';
      const listenerInputData = [{ event: {}, options: { depth: 1 } }];
      let listenerOutputData: any = null;

      channel.addListener(eventName, (...data) => {
        listenerOutputData = data;
      });
      const sendSpy = vi.fn();
      // @ts-expect-error (access private property for testing purposes)
      channel.transports.forEach((t) => {
        t.send = sendSpy;
      });
      channel.emit(eventName, ...listenerInputData);
      expect(listenerOutputData).toEqual(listenerInputData);
      expect(sendSpy.mock.calls[0][1]).toEqual({ depth: 1 });
    });

    it('should use setImmediate if async is true', () => {
      // @ts-expect-error no idea what's going on here!
      global.setImmediate = vi.fn(setImmediate);

      channel = new Channel({ async: true, transport });
      channel.addListener('event1', vi.fn());

      channel.emit('event1', 'test-data');

      expect(setImmediate).toHaveBeenCalled();
    });
  });

  describe('method:eventNames', () => {
    it('should return a list of all registered events', () => {
      const eventNames = ['event1', 'event2', 'event3'];
      eventNames.forEach((eventName) => channel.addListener(eventName, vi.fn()));

      expect(channel.eventNames()).toEqual(eventNames);
    });
  });

  describe('method:listenerCount', () => {
    it('should return a list of all registered events', () => {
      const events = [
        { eventName: 'event1', listeners: [vi.fn(), vi.fn(), vi.fn()], listenerCount: 0 },
        { eventName: 'event2', listeners: [vi.fn()], listenerCount: 0 },
      ];
      events.forEach((event) => {
        event.listeners.forEach((listener) => {
          channel.addListener(event.eventName, listener);

          event.listenerCount++;
        });
      });

      events.forEach((event) => {
        expect(channel.listenerCount(event.eventName)).toBe(event.listenerCount);
      });
    });
  });

  describe('method:once', () => {
    it('should execute a listener once and remove it afterwards', () => {
      const eventName = 'event1';
      channel.once(eventName, vi.fn());
      channel.emit(eventName);

      expect(channel.listenerCount(eventName)).toBe(0);
    });

    it('should pass all event arguments correctly to the listener', () => {
      const eventName = 'event1';
      const listenerInputData = ['string1', 'string2', 'string3'];
      let listenerOutputData = null;
      const mockListener: Listener = (data: string[]) => {
        listenerOutputData = data;
      };

      channel.once(eventName, (args) => mockListener(args));
      channel.emit(eventName, listenerInputData);

      expect(listenerOutputData).toEqual(listenerInputData);
    });

    it('should be removable', () => {
      const eventName = 'event1';
      const listenerToBeRemoved = vi.fn();

      channel.once(eventName, listenerToBeRemoved);
      channel.removeListener(eventName, listenerToBeRemoved);
    });
  });

  describe('method:removeAllListeners', () => {
    it('should remove all listeners', () => {
      const eventName1 = 'event1';
      const eventName2 = 'event2';
      const listeners1 = [vi.fn(), vi.fn(), vi.fn()];
      const listeners2 = [vi.fn()];

      listeners1.forEach((fn) => channel.addListener(eventName1, fn));
      listeners2.forEach((fn) => channel.addListener(eventName2, fn));
      channel.removeAllListeners();

      expect(channel.listenerCount(eventName1)).toBe(0);
      expect(channel.listenerCount(eventName2)).toBe(0);
    });

    it('should remove all listeners of a certain event', () => {
      const eventName = 'event1';
      const listeners = [vi.fn(), vi.fn(), vi.fn()];

      listeners.forEach((fn) => channel.addListener(eventName, fn));
      expect(channel.listenerCount(eventName)).toBe(listeners.length);

      channel.removeAllListeners(eventName);
      expect(channel.listenerCount(eventName)).toBe(0);
    });
  });

  describe('method:removeListener', () => {
    it('should remove one listener', () => {
      const eventName = 'event1';
      const listenerToBeRemoved = vi.fn();
      const listeners = [vi.fn(), vi.fn()];
      const findListener = (listener: Listener) =>
        channel.listeners(eventName)?.find((_listener) => _listener === listener);

      listeners.forEach((fn) => channel.addListener(eventName, fn));
      channel.addListener(eventName, listenerToBeRemoved);
      expect(findListener(listenerToBeRemoved)).toBe(listenerToBeRemoved);

      channel.removeListener(eventName, listenerToBeRemoved);
      expect(findListener(listenerToBeRemoved)).toBeUndefined();
    });
  });
});

describe('WebsocketTransport', () => {
  it('should connect', async () => {
    const onError = vi.fn();
    const handler = vi.fn();

    const transport = new WebsocketTransport({
      url: 'ws://localhost:6006',
      page: 'preview',
      onError,
    });

    transport.setHandler(handler);
    MockedWebsocket.ref.current.onopen();

    expect(handler).toHaveBeenCalledTimes(0);
  });
  it('should send message upon disconnect', async () => {
    const onError = vi.fn();
    const handler = vi.fn();

    const transport = new WebsocketTransport({
      url: 'ws://localhost:6006',
      page: 'preview',
      onError,
    });

    transport.setHandler(handler);
    MockedWebsocket.ref.current.onclose();

    expect(handler.mock.calls[0][0]).toMatchInlineSnapshot(`
      {
        "args": [],
        "from": "preview",
        "type": "channelWSDisconnect",
      }
    `);
  });
  it('should send message when send', async () => {
    const onError = vi.fn();
    const handler = vi.fn();

    const transport = new WebsocketTransport({
      url: 'ws://localhost:6006',
      page: 'preview',
      onError,
    });

    transport.setHandler(handler);
    MockedWebsocket.ref.current.send('{ "type": "test", "args": [], "from": "preview" }');

    expect(handler.mock.calls[0][0]).toMatchInlineSnapshot(`
      {
        "args": [],
        "from": "preview",
        "type": "test",
      }
    `);
  });
  it('should call onError handler', async () => {
    const onError = vi.fn();
    const handler = vi.fn();

    const transport = new WebsocketTransport({
      url: 'ws://localhost:6006',
      page: 'preview',
      onError,
    });

    transport.setHandler(handler);
    MockedWebsocket.ref.current.onerror(new Error('testError'));

    expect(onError.mock.calls[0][0]).toMatchInlineSnapshot(`[Error: testError]`);
  });
});
