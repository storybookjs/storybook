import { describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { EventEmitter } from 'events';
import type { Server } from 'http';
import { stringify } from 'telejson';

import { ServerChannelTransport, getServerChannel } from '../get-server-channel';

describe('getServerChannel', () => {
  it('should return a channel', () => {
    const server = { on: vi.fn() } as any as Server;
    const result = getServerChannel(server, 'test-token-123');
    expect(result).toBeInstanceOf(Channel);
  });

  it('should attach to the http server', () => {
    const server = { on: vi.fn() } as any as Server;
    getServerChannel(server, 'test-token-123');
    expect(server.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });
});

describe('ServerChannelTransport', () => {
  const mockToken = 'test-token-123';

  it('parses simple JSON', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = new ServerChannelTransport(server, mockToken);
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
    const transport = new ServerChannelTransport(server, mockToken);
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
    const transport = new ServerChannelTransport(server, mockToken);
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
    const transport = new ServerChannelTransport(server, mockToken);

    // Simulate upgrade request without token
    const request = {
      url: '/storybook-server-channel',
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
    new ServerChannelTransport(server, mockToken);

    // Simulate upgrade request with wrong token
    const request = {
      url: '/storybook-server-channel?token=wrong-token',
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
    const transport = new ServerChannelTransport(server, mockToken);

    // Mock handleUpgrade to track if it's called
    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    // Simulate upgrade request with correct token
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
    } as any;
    const head = Buffer.from('');

    // @ts-expect-error (accessing private method via upgrade handler)
    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).not.toHaveBeenCalled();
    expect(destroySpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });
});
