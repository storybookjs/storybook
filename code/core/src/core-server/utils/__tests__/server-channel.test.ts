import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { EventEmitter } from 'events';
import type { Server } from 'http';
import { stringify } from 'telejson';

import { ServerChannelTransport, getServerChannel } from '../get-server-channel';

const options = {
  localAddress: 'http://localhost:6006',
  networkAddress: 'http://192.168.1.100:6006',
} as any;

describe('getServerChannel', () => {
  it('should return a channel', () => {
    const server = { on: vi.fn() } as any as Server;
    const result = getServerChannel(server, options, 'test-token-123');
    expect(result).toBeInstanceOf(Channel);
  });

  it('should attach to the http server', () => {
    const server = { on: vi.fn() } as any as Server;
    getServerChannel(server, options, 'test-token-123');
    expect(server.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });
});

describe('ServerChannelTransport', () => {
  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses simple JSON', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = new ServerChannelTransport(server, options, mockToken);
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
    const transport = new ServerChannelTransport(server, options, mockToken);
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
    const transport = new ServerChannelTransport(server, options, mockToken);
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
    const transport = new ServerChannelTransport(server, options, mockToken);

    // Simulate upgrade request without token
    const request = {
      url: '/storybook-server-channel',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

    // Simulate upgrade request with wrong token
    const request = {
      url: '/storybook-server-channel?token=wrong-token',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

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

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

    // Simulate upgrade request with invalid origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://malicious-site.com',
      },
    } as any;
    const head = Buffer.from('');

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

    // Simulate upgrade request without origin header
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {},
    } as any;
    const head = Buffer.from('');

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

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

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

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

    // @ts-expect-error (accessing private method via upgrade handler)
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
    const transport = new ServerChannelTransport(server, options, mockToken);

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

    // @ts-expect-error (accessing private method via upgrade handler)
    server.listeners('upgrade')[0](request, socket, head);

    // Should not call handleUpgrade for wrong path
    expect(handleUpgradeSpy).not.toHaveBeenCalled();
    // Socket should not be destroyed for wrong path (just ignored)
    expect(destroySpy).not.toHaveBeenCalled();
  });
});
