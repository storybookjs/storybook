#!/usr/bin/env node

/**
 * Mock telemetry receiver for local development and testing.
 *
 * Usage:
 *   node scripts/mock-telemetry-receiver.ts
 *
 * Then point Storybook at it:
 *   STORYBOOK_TELEMETRY_URL=http://localhost:6007/event-log yarn storybook
 *
 * Endpoints:
 *   POST /event-log   — receives telemetry events (logs + stores)
 *   GET  /events      — returns all received events as JSON array
 *   GET  /events/:type — returns events filtered by eventType
 */

import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT || 6007);
const LOG_DIR = resolve(process.env.LOG_DIR || '.cache/telemetry-debug');
const events: Array<{ receivedAt: string; [key: string]: unknown }> = [];

await mkdir(LOG_DIR, { recursive: true });

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/event-log') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const entry = { receivedAt: new Date().toISOString(), ...data };
        events.push(entry);
        console.log(`\n[telemetry] ${data.eventType || 'unknown'}`);
        console.log(JSON.stringify(data, null, 2));
        await writeFile(
          resolve(LOG_DIR, `events-${new Date().toISOString().slice(0, 10)}.jsonl`),
          JSON.stringify(entry) + '\n',
          { flag: 'a' }
        );
        res.statusCode = 200;
        res.end('ok');
      } catch {
        res.statusCode = 400;
        res.end('bad json');
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/events')) {
    const typeFilter = req.url.split('/events/')[1];
    const filtered = typeFilter ? events.filter((e) => e.eventType === typeFilter) : events;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(filtered));
    return;
  }

  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`Mock telemetry receiver listening on http://localhost:${PORT}/event-log`);
  console.log(`GET http://localhost:${PORT}/events to see all received events`);
  console.log(`GET http://localhost:${PORT}/events/<type> to filter by event type`);
  console.log(`Logs in ${LOG_DIR}`);
});
