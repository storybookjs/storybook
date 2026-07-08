import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, HEARTBEAT_INTERVAL } from 'storybook/internal/channels';

import { EventEmitter } from 'events';
import type { Server } from 'http';
import { parse, stringify } from 'telejson';
import WebSocket from 'ws';

import { ServerChannelTransport, getServerChannel } from '../get-server-channel.ts';

const mockToken = 'test-token-123';

const options = {
  localAddress: 'http://localhost:6006',
  networkAddress: 'http://192.168.1.100:6006',
  token: mockToken,
} as any;

const webContainerOptions = {
  ...options,
  skipValidation: true,
} as any;

describe('getServerChannel', () => {
  it('should return a channel', () => {
    const server = { on: vi.fn() } as any as Server;
    const result = getServerChannel(server, options);
    expect(result).toBeInstanceOf(Channel);
  });

  it('should attach to the http server', () => {
    const server = { on: vi.fn() } as any as Server;
    getServerChannel(server, options);
    expect(server.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });
});

describe('ServerChannelTransport', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses simple JSON', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = new ServerChannelTransport(server, options);
    const handler = vi.fn();
    transport.setHandler(handler);

    // @ts-expect-error (an internal API)
    transport.socket.emit('connection', socket);
    socket.emit('message', '"hello"');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('parses object JSON', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = new ServerChannelTransport(server, options);
    const handler = vi.fn();
    transport.setHandler(handler);

    // @ts-expect-error (an internal API)
    transport.socket.emit('connection', socket);
    socket.emit('message', JSON.stringify({ type: 'hello' }));

    expect(handler).toHaveBeenCalledWith({ type: 'hello' });
  });

  it('supports telejson cyclical data', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = new ServerChannelTransport(server, options);
    const handler = vi.fn();
    transport.setHandler(handler);

    // @ts-expect-error (an internal API)
    transport.socket.emit('connection', socket);

    const input: any = { a: 1 };
    input.b = input;
    socket.emit('message', stringify(input));

    expect(handler.mock.calls[0][0]).toMatchInlineSnapshot(`
      {
        "a": 1,
        "b": [Circular],
      }
    `);
  });

  it('rejects connections without token', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const transport = new ServerChannelTransport(server, options);

    // Simulate upgrade request without token
    const request = {
      url: '/storybook-server-channel',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).toHaveBeenCalledWith(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'
    );
    expect(destroySpy).toHaveBeenCalled();
  });

  it('rejects connections with invalid token', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    new ServerChannelTransport(server, options);

    // Simulate upgrade request with wrong token
    const request = {
      url: '/storybook-server-channel?token=wrong-token',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).toHaveBeenCalledWith(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'
    );
    expect(destroySpy).toHaveBeenCalled();
  });

  it('accepts connections with valid token', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, options);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    // Simulate upgrade request with correct token and valid origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).not.toHaveBeenCalled();
    expect(destroySpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('rejects connections with invalid origin', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const transport = new ServerChannelTransport(server, options);

    // Simulate upgrade request with invalid origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://malicious-site.com',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).toHaveBeenCalledWith(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'
    );
    expect(destroySpy).toHaveBeenCalled();
  });

  it('rejects connections without origin header', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const transport = new ServerChannelTransport(server, options);

    // Simulate upgrade request without origin header
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {},
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).toHaveBeenCalledWith(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'
    );
    expect(destroySpy).toHaveBeenCalled();
  });

  it('accepts connections with network address origin', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, options);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    // Simulate upgrade request with network address origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://192.168.1.100:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).not.toHaveBeenCalled();
    expect(destroySpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('accepts connections with 127.0.0.1 origin', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, options);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    // Simulate upgrade request with 127.0.0.1 origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://127.0.0.1:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).not.toHaveBeenCalled();
    expect(destroySpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('rejects connections to wrong path', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, options);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    // Simulate upgrade request to wrong path
    const request = {
      url: `/wrong-path?token=${mockToken}`,
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    // Should not call handleUpgrade for wrong path
    expect(handleUpgradeSpy).not.toHaveBeenCalled();
    // Socket should not be destroyed for wrong path (just ignored)
    expect(destroySpy).not.toHaveBeenCalled();
  });

  it('accepts connections without token when validation is disabled', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, webContainerOptions);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    const request = {
      url: '/storybook-server-channel',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).not.toHaveBeenCalled();
    expect(destroySpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('accepts connections with invalid origin when validation is disabled', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, webContainerOptions);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    const request = {
      url: '/storybook-server-channel?token=wrong-token',
      headers: {
        origin: 'http://malicious-site.com',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).not.toHaveBeenCalled();
    expect(destroySpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });
});

describe('ServerChannelTransport heartbeat priority', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const connectFakeClient = (transport: ServerChannelTransport) => {
    const client = { readyState: WebSocket.OPEN, send: vi.fn() };
    // @ts-expect-error (an internal API; mirrors how WebSocketServer itself populates `clients`)
    transport.socket.clients.add(client);
    return client;
  };

  const sentTypes = (client: { send: (data: string) => void }) =>
    (client.send as any).mock.calls.map(([data]: [string]) => parse(data).type);

  it('proactively sends a ping from send() once the heartbeat is overdue, without waiting for the scheduled interval', () => {
    const server = new EventEmitter() as any as Server;
    const transport = new ServerChannelTransport(server, options);
    const client = connectFakeClient(transport);

    transport.send({ type: 'STORY_RENDERED' });

    // Jump the clock past HEARTBEAT_INTERVAL without advancing any timers, so the scheduled
    // `setInterval` callback never runs. Only the opportunistic check inside send() can be
    // responsible for the ping that follows.
    vi.setSystemTime(new Date(Date.now() + HEARTBEAT_INTERVAL));

    transport.send({ type: 'STORY_RENDERED' });

    expect(sentTypes(client)).toEqual(['STORY_RENDERED', 'ping', 'STORY_RENDERED']);
  });

  it('does not send a redundant ping from send() when the heartbeat is not yet overdue', () => {
    const server = new EventEmitter() as any as Server;
    const transport = new ServerChannelTransport(server, options);
    const client = connectFakeClient(transport);

    transport.send({ type: 'STORY_RENDERED' });
    vi.setSystemTime(new Date(Date.now() + HEARTBEAT_INTERVAL - 1));
    transport.send({ type: 'STORY_RENDERED' });

    expect(sentTypes(client)).toEqual(['STORY_RENDERED', 'STORY_RENDERED']);
  });

  it('does not double up when send() is asked to broadcast a ping directly', () => {
    const server = new EventEmitter() as any as Server;
    const transport = new ServerChannelTransport(server, options);
    const client = connectFakeClient(transport);

    vi.setSystemTime(new Date(Date.now() + HEARTBEAT_INTERVAL));
    transport.send({ type: 'ping' });

    expect(sentTypes(client)).toEqual(['ping']);
  });
});
