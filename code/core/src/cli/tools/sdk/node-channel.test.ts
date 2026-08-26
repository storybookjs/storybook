import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events';

import { isJSON, parse, stringify } from 'telejson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WebSocket, WebSocketServer } from 'ws';

import { getChannel, installNoopChannel, setChannel } from '../../../channels/channel-slot.ts';
import { SERVER_CHANNEL_PATH } from '../../../channels/websocket/index.ts';
import { UniversalStore } from '../../../shared/universal-store/index.ts';
import { createNodeChannel, type NodeChannelConnection } from './node-channel.ts';

const TOKEN = 'a-dev-server-token';

let httpServer: Server;
let wsServer: WebSocketServer;
let baseUrl: string;
let upgradeUrls: string[];
let originHeaders: (string | undefined)[];
let connections: WebSocket[];
let receivedByServer: any[];
let clients: NodeChannelConnection[];

const firstConnection = async () => {
  await vi.waitFor(() => expect(connections).toHaveLength(1));
  return connections[0];
};

beforeEach(async () => {
  upgradeUrls = [];
  originHeaders = [];
  connections = [];
  receivedByServer = [];
  clients = [];

  httpServer = createServer();
  wsServer = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    upgradeUrls.push(request.url!);
    originHeaders.push(request.headers.origin);
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request);
    });
  });

  wsServer.on('connection', (ws) => {
    connections.push(ws);
    ws.on('message', (raw) => {
      const data = raw.toString();
      receivedByServer.push(isJSON(data) ? parse(data) : data);
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.close();
  }
  connections.forEach((ws) => ws.terminate());
  wsServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

const openChannel = (url = baseUrl) => {
  const client = createNodeChannel({ url, token: TOKEN });
  clients.push(client);
  return client;
};

describe('createNodeChannel', () => {
  it('connects to the server channel path with the token in the query string', async () => {
    const { connected } = openChannel();

    await firstConnection();
    await expect(connected).resolves.toBeUndefined();
    expect(upgradeUrls).toEqual([`${SERVER_CHANNEL_PATH}?token=${TOKEN}`]);
  });

  it('sends no Origin header, which browsers cannot omit', async () => {
    openChannel();

    await firstConnection();
    expect(originHeaders).toEqual([undefined]);
  });

  it('replaces the path and query of the given base url', async () => {
    openChannel(`${baseUrl}/some/base/path?existing=param`);

    await firstConnection();
    expect(upgradeUrls).toEqual([`${SERVER_CHANNEL_PATH}?token=${TOKEN}`]);
  });

  it('replies to a server ping with a pong', async () => {
    openChannel();
    const connection = await firstConnection();

    connection.send(stringify({ type: 'ping' }));

    await vi.waitFor(() => expect(receivedByServer).toContainEqual({ type: 'pong' }));
  });

  it('does not surface transport pings as channel events', async () => {
    const { channel } = openChannel();
    const onPing = vi.fn();
    channel.on('ping', onPing);
    const connection = await firstConnection();

    connection.send(stringify({ type: 'ping' }));

    await vi.waitFor(() => expect(receivedByServer).toContainEqual({ type: 'pong' }));
    expect(onPing).not.toHaveBeenCalled();
  });

  it('round-trips telejson-only values in both directions', async () => {
    const { channel } = openChannel();
    const connection = await firstConnection();

    channel.emit('outgoing', { when: new Date('2026-08-20T00:00:00.000Z'), pattern: /token/gi });

    await vi.waitFor(() => expect(receivedByServer).toHaveLength(1));
    expect(receivedByServer[0]).toMatchObject({
      type: 'outgoing',
      args: [{ when: new Date('2026-08-20T00:00:00.000Z'), pattern: /token/gi }],
    });

    const received: any[] = [];
    channel.on('incoming', (payload) => received.push(payload));
    connection.send(
      stringify({
        type: 'incoming',
        args: [{ when: new Date('2025-01-02T03:04:05.000Z'), pattern: /server/g }],
        from: 'server',
      })
    );

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toEqual({
      when: new Date('2025-01-02T03:04:05.000Z'),
      pattern: /server/g,
    });
  });

  it('emits CHANNEL_WS_DISCONNECT and rejects with a dev server disconnected error on close', async () => {
    const { channel, disconnected } = openChannel();
    const disconnects: any[] = [];
    channel.on(CHANNEL_WS_DISCONNECT, (payload) => disconnects.push(payload));
    const connection = await firstConnection();

    connection.close(3008, 'timeout');

    await expect(disconnected).rejects.toThrow('Storybook dev server disconnected');
    expect(disconnects).toEqual([{ code: 3008, reason: 'timeout' }]);
  });

  it('rejects with a dev server disconnected error when the server was never reachable', async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));

    const { disconnected } = openChannel();

    await expect(disconnected).rejects.toThrow('Storybook dev server disconnected');
  });

  it('restores the process channel and UniversalStore on close', async () => {
    const previousChannel = getChannel();
    const previousEnvironment = UniversalStore.preparedEnvironment;
    const client = openChannel();

    expect(getChannel()).toBe(client.channel);
    expect(UniversalStore.preparedEnvironment).toBe(UniversalStore.Environment.UNKNOWN);

    await firstConnection();
    client.close();

    expect(getChannel()).toBe(previousChannel);
    expect(UniversalStore.preparedEnvironment).toBe(previousEnvironment);
  });

  it('does not restore the process channel when another caller owns the slot', async () => {
    const client = openChannel();
    await firstConnection();
    const replacement = {};
    setChannel(replacement as never);

    client.close();

    expect(getChannel()).toBe(replacement);
    installNoopChannel();
  });

  it('does not restore a closed overlapping node channel', async () => {
    const previousChannel = getChannel();
    const previousEnvironment = UniversalStore.preparedEnvironment;
    const first = openChannel();
    await firstConnection();
    const second = openChannel();
    await vi.waitFor(() => expect(connections).toHaveLength(2));

    first.close();
    expect(getChannel()).toBe(second.channel);

    second.close();
    expect(getChannel()).toBe(previousChannel);
    expect(UniversalStore.preparedEnvironment).toBe(previousEnvironment);
  });

  it('restores the remaining node channel when the later one closes first', async () => {
    const previousChannel = getChannel();
    const first = openChannel();
    await firstConnection();
    const second = openChannel();
    await vi.waitFor(() => expect(connections).toHaveLength(2));

    second.close();
    expect(getChannel()).toBe(first.channel);

    first.close();
    expect(getChannel()).toBe(previousChannel);
  });
});
