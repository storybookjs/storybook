import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { EventEmitter } from 'node:events';
import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import { stringify } from 'telejson';
import type { WebSocketServer } from 'ws';

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
    const socket = new EventEmitter();
    const transport = createTransport(server);
    const handler = vi.fn();
    transport.setHandler(handler);

    websocketServer(transport).emit('connection', socket);
    socket.emit('message', '"hello"');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('parses object JSON', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = createTransport(server);
    const handler = vi.fn();
    transport.setHandler(handler);

    websocketServer(transport).emit('connection', socket);
    socket.emit('message', JSON.stringify({ type: 'hello' }));

    expect(handler).toHaveBeenCalledWith({ type: 'hello' });
  });

  it('supports telejson cyclical data', () => {
    const server = new EventEmitter() as any as Server;
    const socket = new EventEmitter();
    const transport = createTransport(server);
    const handler = vi.fn();
    transport.setHandler(handler);

    websocketServer(transport).emit('connection', socket);

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
      url: `/storybook-server-channel?token=${mockToken}`,
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
      url: `/storybook-server-channel?token=${mockToken}`,
      headers: {
        origin: 'http://192.168.1.100:6006',
      },
    } as any;
    const head = Buffer.from('');

    server.listeners('upgrade')[0](request, socket, head);

    expect(endSpy).not.toHaveBeenCalled();
    expect(handleUpgradeSpy).toHaveBeenCalled();
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
      url: `/storybook-server-channel?token=${mockToken}`,
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
      url: '/storybook-server-channel',
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
      url: '/storybook-server-channel?token=wrong-token',
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
});
