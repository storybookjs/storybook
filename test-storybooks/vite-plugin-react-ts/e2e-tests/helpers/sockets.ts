import type { Page } from '@playwright/test';

/** The parts of Playwright's `WebSocket` the specs read. */
export type ChannelSocket = {
  isClosed(): boolean;
  url(): string;
  waitForEvent(event: 'close', options?: { timeout?: number }): Promise<unknown>;
};

/** A WebSocket a page opened, with the payloads the server sent on it so far. */
export type TrackedSocket = {
  socket: ChannelSocket;
  received: string[];
};

/** Records every WebSocket `page` opens whose URL contains `urlPart`, in opening order. */
export function trackSockets(page: Page, urlPart: string): TrackedSocket[] {
  const sockets: TrackedSocket[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes(urlPart)) {
      return;
    }
    const tracked: TrackedSocket = { socket, received: [] };
    socket.on('framereceived', ({ payload }) => {
      tracked.received.push(payload.toString());
    });
    sockets.push(tracked);
  });
  return sockets;
}
