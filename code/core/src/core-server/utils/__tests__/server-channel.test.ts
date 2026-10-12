import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/channels';

import {
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
  STORY_RENDERED,
} from '@storybook/core/core-events';

import { EventEmitter } from 'events';
import type { Server } from 'http';
import { stringify } from 'telejson';

import { ServerChannelTransport, getServerChannel } from '../get-server-channel';

// This machine is 192.168.1.100 on its LAN and 10.0.0.7 on a second interface.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const networkInterfaces = () => ({
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false }],
    wlan0: [{ address: '10.0.0.7', family: 'IPv4', internal: false }],
  });
  return { ...actual, default: { ...actual, networkInterfaces }, networkInterfaces };
});

const mockToken = 'test-token-123';

const options = {
  localAddress: 'http://localhost:6006',
  networkAddress: 'http://192.168.1.100:6006',
  token: mockToken,
} as any;

function connectClient(server: Server, transport: ServerChannelTransport, page: string) {
  const client = new EventEmitter();
  // @ts-expect-error (accessing private property)
  transport.socket.handleUpgrade = vi.fn((request, _socket, _head, callback) =>
    callback(client, request)
  );
  const request = {
    url: `/storybook-server-channel?token=${mockToken}&page=${page}`,
    headers: { origin: 'http://localhost:6006' },
  };
  server.listeners('upgrade')[0](
    request,
    { write: vi.fn(), destroy: vi.fn(), end: vi.fn() },
    Buffer.from('')
  );
  return client;
}

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
    const transport = new ServerChannelTransport(server, options);
    const handler = vi.fn();
    transport.setHandler(handler);

    const socket = connectClient(server, transport, 'manager');
    socket.emit('message', '"hello"');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('parses object JSON', () => {
    const server = new EventEmitter() as any as Server;
    const transport = new ServerChannelTransport(server, options);
    const handler = vi.fn();
    transport.setHandler(handler);

    const socket = connectClient(server, transport, 'manager');
    socket.emit('message', JSON.stringify({ type: 'hello' }));

    expect(handler).toHaveBeenCalledWith({ type: 'hello' });
  });

  it('supports telejson cyclical data', () => {
    const server = new EventEmitter() as any as Server;
    const transport = new ServerChannelTransport(server, options);
    const handler = vi.fn();
    transport.setHandler(handler);

    const socket = connectClient(server, transport, 'manager');

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
      url: `/storybook-server-channel?token=${mockToken}&page=manager`,
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

  it('rejects connections from an origin at an unknown IP address', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    const destroySpy = vi.spyOn(socket, 'destroy');
    const handleUpgradeSpy = vi.fn();
    const transport = new ServerChannelTransport(server, options);

    // @ts-expect-error (accessing private property)
    transport.socket.handleUpgrade = handleUpgradeSpy;

    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://203.0.113.5',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(socket.write).toHaveBeenCalledWith(
      'HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'
    );
    expect(destroySpy).toHaveBeenCalled();
    expect(handleUpgradeSpy).not.toHaveBeenCalled();
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
      url: `/storybook-server-channel?token=${mockToken}&page=manager`,
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

  describe('origins on the local network', () => {
    const isUpgradeAccepted = (origin: string, transportOptions: typeof options) => {
      const server = new EventEmitter() as any as Server;
      const socket = new EventEmitter() as any;
      socket.write = vi.fn();
      socket.destroy = vi.fn();
      const handleUpgradeSpy = vi.fn();
      const transport = new ServerChannelTransport(server, transportOptions);

      // @ts-expect-error (accessing private property)
      transport.socket.handleUpgrade = handleUpgradeSpy;

      server.listeners('upgrade')[0](
        {
          url: `/storybook-server-channel?token=${mockToken}&page=manager`,
          headers: { origin },
        } as any,
        socket,
        Buffer.from('')
      );

      return handleUpgradeSpy.mock.calls.length > 0;
    };

    it.each([
      ['without --host', options],
      ['when --host is the LAN address of this machine', { ...options, host: '192.168.1.100' }],
      [
        'when --host is 0.0.0.0 and core.allowedHosts is a list',
        { ...options, host: '0.0.0.0', allowedHosts: ['storybook.example.com'] },
      ],
    ])('rejects an origin served by another machine on the LAN %s', (_, transportOptions) => {
      expect(isUpgradeAccepted('http://192.168.1.50:6006', transportOptions)).toBe(false);
    });

    it('accepts an origin served by another machine on the LAN when core.allowedHosts lists it', () => {
      expect(
        isUpgradeAccepted('http://192.168.1.50:6006', {
          ...options,
          allowedHosts: ['192.168.1.50'],
        })
      ).toBe(true);
    });

    it('accepts an origin at the LAN address of this machine when --host is that address', () => {
      expect(
        isUpgradeAccepted('http://192.168.1.100:6006', { ...options, host: '192.168.1.100' })
      ).toBe(true);
    });

    it('accepts an origin at another address of this machine when --host is 0.0.0.0', () => {
      expect(
        isUpgradeAccepted('http://10.0.0.7:6006', {
          ...options,
          host: '0.0.0.0',
          allowedHosts: ['storybook.example.com'],
        })
      ).toBe(true);
    });
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
      url: `/storybook-server-channel?token=${mockToken}&page=manager`,
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

  describe('client role separation', () => {
    it('drops manager-only events from a preview connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = new ServerChannelTransport(server, options);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'preview');
      socket.emit('message', JSON.stringify({ type: SAVE_STORY_REQUEST, args: [] }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts manager-only events from a manager connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = new ServerChannelTransport(server, options);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'manager');
      socket.emit('message', JSON.stringify({ type: SAVE_STORY_REQUEST, args: [] }));

      expect(handler).toHaveBeenCalledWith({ type: SAVE_STORY_REQUEST, args: [] });
    });

    it('drops preview-only events from a manager connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = new ServerChannelTransport(server, options);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'manager');
      socket.emit('message', JSON.stringify({ type: STORY_RENDERED, args: [] }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts preview-only events from a preview connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = new ServerChannelTransport(server, options);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'preview');
      socket.emit('message', JSON.stringify({ type: STORY_RENDERED, args: [] }));

      expect(handler).toHaveBeenCalledWith({ type: STORY_RENDERED, args: [] });
    });

    it('accepts unrestricted events from either browser connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = new ServerChannelTransport(server, options);
      const handler = vi.fn();
      transport.setHandler(handler);

      connectClient(server, transport, 'preview').emit(
        'message',
        JSON.stringify({ type: 'someEvent', args: [] })
      );
      connectClient(server, transport, 'manager').emit(
        'message',
        JSON.stringify({ type: 'someEvent', args: [] })
      );

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('drops server-sent events arriving from any browser connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = new ServerChannelTransport(server, options);
      const handler = vi.fn();
      transport.setHandler(handler);

      connectClient(server, transport, 'manager').emit(
        'message',
        JSON.stringify({ type: SAVE_STORY_RESPONSE, args: [] })
      );
      connectClient(server, transport, 'preview').emit(
        'message',
        JSON.stringify({ type: SAVE_STORY_RESPONSE, args: [] })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects upgrades that declare no page', () => {
      const server = new EventEmitter() as any as Server;
      const socket = new EventEmitter() as any;
      socket.write = vi.fn();
      socket.destroy = vi.fn();
      socket.end = vi.fn();
      const handleUpgradeSpy = vi.fn();
      const transport = new ServerChannelTransport(server, options);

      // @ts-expect-error (accessing private property)
      transport.socket.handleUpgrade = handleUpgradeSpy;

      const request = {
        url: `/storybook-server-channel?token=${mockToken}`,
        headers: { origin: 'http://localhost:6006' },
      } as any;

      server.listeners('upgrade')[0](request, socket, Buffer.from(''));

      expect(socket.end).toHaveBeenCalledWith(
        'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'
      );
      expect(handleUpgradeSpy).not.toHaveBeenCalled();
    });

    it('rejects upgrades that declare an unknown page', () => {
      const server = new EventEmitter() as any as Server;
      const socket = new EventEmitter() as any;
      socket.write = vi.fn();
      socket.destroy = vi.fn();
      socket.end = vi.fn();
      const handleUpgradeSpy = vi.fn();
      const transport = new ServerChannelTransport(server, options);

      // @ts-expect-error (accessing private property)
      transport.socket.handleUpgrade = handleUpgradeSpy;

      const request = {
        url: `/storybook-server-channel?token=${mockToken}&page=admin`,
        headers: { origin: 'http://localhost:6006' },
      } as any;

      server.listeners('upgrade')[0](request, socket, Buffer.from(''));

      expect(socket.end).toHaveBeenCalledWith(
        'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'
      );
      expect(handleUpgradeSpy).not.toHaveBeenCalled();
    });
  });
});
