import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { EventEmitter } from 'node:events';
import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import { stringify } from 'telejson';
import type { WebSocketServer } from 'ws';

import {
  PREVIEW_INITIALIZED,
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
} from 'storybook/internal/core-events';

import { ServerChannelTransport, getServerChannel } from '../get-server-channel.ts';

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

const webContainerOptions = {
  ...options,
  skipValidation: true,
} as any;

const createdTransports: ServerChannelTransport[] = [];

function createTransport(
  server: Server,
  transportOptions: typeof options = options
): ServerChannelTransport {
  const transport = new ServerChannelTransport(server, transportOptions);
  createdTransports.push(transport);
  return transport;
}

function closeCreatedTransports() {
  for (const transport of createdTransports.splice(0)) {
    transport.close();
  }
}

function websocketServer(transport: ServerChannelTransport) {
  return (transport as unknown as { socket: WebSocketServer }).socket;
}

function connectClient(server: Server, transport: ServerChannelTransport, page?: string) {
  const client = new EventEmitter();
  vi.spyOn(websocketServer(transport), 'handleUpgrade').mockImplementation(
    (request, _socket, _head, callback) => callback(client as any, request)
  );
  const query = page ? `&page=${page}` : '';
  const request = { url: `/storybook-server-channel?token=${mockToken}${query}`, headers: {} };
  server.listeners('upgrade')[0](request, { end: vi.fn() }, Buffer.from(''));
  return client;
}

async function readRejectedUpgrade(requestLines: string[]): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('expected a TCP address');
  }
  const transport = new ServerChannelTransport(server, options);
  const client = connect({ host: '127.0.0.1', port: address.port });
  try {
    return await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      client.on('data', (chunk) => chunks.push(chunk));
      client.on('error', reject);
      client.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      client.on('connect', () => {
        client.write(`${requestLines.join('\r\n')}\r\n\r\n`);
      });
    });
  } finally {
    client.destroy();
    transport.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('getServerChannel', () => {
  afterEach(() => {
    closeCreatedTransports();
  });

  it('should return a channel', () => {
    const server = { on: vi.fn() } as any as Server;
    const result = getServerChannel(server, options);
    // @ts-expect-error private transports
    createdTransports.push(...result.transports);
    expect(result).toBeInstanceOf(Channel);
  });

  it('should attach to the http server', () => {
    const server = { on: vi.fn() } as any as Server;
    const result = getServerChannel(server, options);
    // @ts-expect-error private transports
    createdTransports.push(...result.transports);
    expect(server.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });
});

describe('ServerChannelTransport', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    closeCreatedTransports();
    vi.restoreAllMocks();
  });

  it('unregisters the SIGTERM listener when closed', () => {
    const before = process.listenerCount('SIGTERM');
    const server = new EventEmitter() as any as Server;
    const transport = createTransport(server);
    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
    transport.close();
    transport.close();
    expect(process.listenerCount('SIGTERM')).toBe(before);
  });

  it('parses simple JSON', () => {
    const server = new EventEmitter() as any as Server;
    const transport = createTransport(server);
    const handler = vi.fn();
    transport.setHandler(handler);

    const socket = connectClient(server, transport);
    socket.emit('message', '"hello"');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('parses object JSON', () => {
    const server = new EventEmitter() as any as Server;
    const transport = createTransport(server);
    const handler = vi.fn();
    transport.setHandler(handler);

    const socket = connectClient(server, transport);
    socket.emit('message', JSON.stringify({ type: 'hello' }));

    expect(handler).toHaveBeenCalledWith({ type: 'hello' });
  });

  it('supports telejson cyclical data', () => {
    const server = new EventEmitter() as any as Server;
    const transport = createTransport(server);
    const handler = vi.fn();
    transport.setHandler(handler);

    const socket = connectClient(server, transport);

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
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);

    // Simulate upgrade request without token
    const request = {
      url: '/storybook-server-channel',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
  });

  it('rejects connections with invalid token', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    createTransport(server);

    // Simulate upgrade request with wrong token
    const request = {
      url: '/storybook-server-channel?token=wrong-token',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
  });

  it('accepts connections with valid token', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    // Simulate upgrade request with correct token and valid origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}&page=manager`,
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('rejects connections with invalid origin', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);

    // Simulate upgrade request with invalid origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://malicious-site.com',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });

  it('rejects connections from an origin at an unknown IP address', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://203.0.113.5',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    expect(handleUpgradeSpy).not.toHaveBeenCalled();
  });

  it('accepts connections without origin header when the token is valid', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    const request = {
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {},
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('rejects connections without origin header when the token is invalid', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    const request = {
      url: '/storybook-server-channel?token=wrong-token',
      headers: {},
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    expect(handleUpgradeSpy).not.toHaveBeenCalled();
  });

  it('rejects connections without origin header and without token', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    const request = {
      url: '/storybook-server-channel',
      headers: {},
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    expect(handleUpgradeSpy).not.toHaveBeenCalled();
  });

  it('accepts connections with network address origin', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    // Simulate upgrade request with network address origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}&page=manager`,
      headers: {
        origin: 'http://192.168.1.100:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  describe('origins on the local network', () => {
    const isUpgradeAccepted = (origin: string, transportOptions: typeof options) => {
      const server = new EventEmitter() as any as Server;
      const socket = new EventEmitter() as any;
      socket.end = vi.fn();
      const transport = createTransport(server, transportOptions);
      const handleUpgradeSpy = vi
        .spyOn(websocketServer(transport), 'handleUpgrade')
        .mockImplementation(() => {});

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
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    // Simulate upgrade request with 127.0.0.1 origin
    const request = {
      url: `/storybook-server-channel?token=${mockToken}&page=manager`,
      headers: {
        origin: 'http://127.0.0.1:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('rejects connections to wrong path', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

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
    expect(endSpy).not.toHaveBeenCalled();
  });

  it('accepts connections without token when validation is disabled', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server, webContainerOptions);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    const request = {
      url: '/storybook-server-channel?page=manager',
      headers: {
        origin: 'http://localhost:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('accepts connections with invalid origin when validation is disabled', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter() as any;
    socket.end = vi.fn();
    const endSpy = vi.spyOn(socket, 'end');
    const transport = createTransport(server, webContainerOptions);
    const handleUpgradeSpy = vi
      .spyOn(websocketServer(transport), 'handleUpgrade')
      .mockImplementation(() => {});

    const request = {
      url: '/storybook-server-channel?token=wrong-token&page=manager',
      headers: {
        origin: 'http://malicious-site.com',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
  });

  it('flushes HTTP 401 to a real client when the token is missing', async () => {
    const response = await readRejectedUpgrade([
      'GET /storybook-server-channel HTTP/1.1',
      'Host: 127.0.0.1',
      'Connection: Upgrade',
      'Upgrade: websocket',
    ]);
    expect(response).toContain('HTTP/1.1 401 Unauthorized');
  });

  it('flushes HTTP 403 to a real client when Origin is invalid', async () => {
    const response = await readRejectedUpgrade([
      `GET /storybook-server-channel?token=${mockToken} HTTP/1.1`,
      'Host: 127.0.0.1',
      'Connection: Upgrade',
      'Upgrade: websocket',
      'Origin: http://malicious-site.com',
    ]);
    expect(response).toContain('HTTP/1.1 403 Forbidden');
  });
  describe('client role separation', () => {
    it('drops manager-only events from a preview connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'preview');
      socket.emit('message', JSON.stringify({ type: SAVE_STORY_REQUEST, args: [] }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts manager-only events from a manager connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'manager');
      socket.emit('message', JSON.stringify({ type: SAVE_STORY_REQUEST, args: [] }));

      expect(handler).toHaveBeenCalledWith({ type: SAVE_STORY_REQUEST, args: [] });
    });

    it('drops preview-only events from a manager connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'manager');
      socket.emit('message', JSON.stringify({ type: PREVIEW_INITIALIZED, args: [] }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts preview-only events from a preview connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport, 'preview');
      socket.emit('message', JSON.stringify({ type: PREVIEW_INITIALIZED, args: [] }));

      expect(handler).toHaveBeenCalledWith({ type: PREVIEW_INITIALIZED, args: [] });
    });

    it('accepts unrestricted events from either browser connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
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

    it('accepts only server-sent and unrestricted events from a connection without a page parameter', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
      const handler = vi.fn();
      transport.setHandler(handler);

      const socket = connectClient(server, transport);
      socket.emit('message', JSON.stringify({ type: SAVE_STORY_REQUEST, args: [] }));
      socket.emit('message', JSON.stringify({ type: PREVIEW_INITIALIZED, args: [] }));
      socket.emit('message', JSON.stringify({ type: SAVE_STORY_RESPONSE, args: [] }));
      socket.emit('message', JSON.stringify({ type: 'someEvent', args: [] }));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith({ type: SAVE_STORY_RESPONSE, args: [] });
      expect(handler).toHaveBeenCalledWith({ type: 'someEvent', args: [] });
    });

    it('drops server-sent events arriving from any browser connection', () => {
      const server = new EventEmitter() as any as Server;
      const transport = createTransport(server);
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

    it('rejects upgrades from a browser that declares no page', () => {
      const server = new EventEmitter() as any as Server;
      const socket = new EventEmitter() as any;
      socket.end = vi.fn();
      const endSpy = vi.spyOn(socket, 'end');
      const transport = createTransport(server);
      const handleUpgradeSpy = vi
        .spyOn(websocketServer(transport), 'handleUpgrade')
        .mockImplementation(() => {});

      const request = {
        url: `/storybook-server-channel?token=${mockToken}`,
        headers: { origin: 'http://localhost:6006' },
      } as any;

      server.listeners('upgrade')[0](request, socket, Buffer.from(''));

      expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      expect(handleUpgradeSpy).not.toHaveBeenCalled();
    });

    it('rejects upgrades that declare an unknown page', () => {
      const server = new EventEmitter() as any as Server;
      const socket = new EventEmitter() as any;
      socket.end = vi.fn();
      const endSpy = vi.spyOn(socket, 'end');
      const transport = createTransport(server);
      const handleUpgradeSpy = vi
        .spyOn(websocketServer(transport), 'handleUpgrade')
        .mockImplementation(() => {});

      const request = {
        url: `/storybook-server-channel?token=${mockToken}&page=admin`,
        headers: { origin: 'http://localhost:6006' },
      } as any;

      server.listeners('upgrade')[0](request, socket, Buffer.from(''));

      expect(endSpy).toHaveBeenCalledWith('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      expect(handleUpgradeSpy).not.toHaveBeenCalled();
    });
  });

  it('does not crash when a socket emits an error', () => {
    const server = new EventEmitter() as any as Server;
    const transport = createTransport(server);

    const socket = connectClient(server, transport, 'manager');

    expect(() => socket.emit('error', new Error('Max payload size exceeded'))).not.toThrow();
  });
});
