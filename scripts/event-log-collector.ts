#!/usr/bin/env node

/**
 * Telemetry event log collector for local development and testing.
 *
 * Usage:
 *   node scripts/event-log-collector.ts [--include <regex>] [--exclude <regex>]
 *
 * Then point Storybook at it:
 *   STORYBOOK_TELEMETRY_URL=http://localhost:6007/event-log yarn storybook
 *
 * Options:
 *   --include <regex>   Only collect events whose eventType matches the regex
 *   --exclude <regex>   Skip events whose eventType matches the regex
 *   --no-metadata       Hide the metadata property when logging events
 *
 * Examples:
 *   node scripts/event-log-collector.ts --include "ai-.*"
 *   node scripts/event-log-collector.ts --exclude "mocking"
 *   node scripts/event-log-collector.ts --include "ai-.*" --exclude "ai-debug"
 *   node scripts/event-log-collector.ts --no-metadata
 *
 * Endpoints:
 *   POST /event-log          — receives telemetry events (logs + stores)
 *   GET  /event-log          — returns all received events as JSON array
 *   GET  /events             — alias: returns all received events as JSON array
 *   GET  /events/:type       — returns events filtered by eventType
 */

import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const getFlag = (flag: string): string | undefined => {
  for (const arg of args) {
    if (arg === flag) return args[args.indexOf(arg) + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
};

const includePattern = getFlag('--include');
const excludePattern = getFlag('--exclude');
const includeRegex = includePattern ? new RegExp(includePattern) : null;
const excludeRegex = excludePattern ? new RegExp(excludePattern) : null;
const hideMetadata = args.includes('--no-metadata');

const matchesFilter = (eventType: string): boolean => {
  if (includeRegex && !includeRegex.test(eventType)) return false;
  if (excludeRegex && excludeRegex.test(eventType)) return false;
  return true;
};

const PORT = Number(process.env.PORT || 6007);
const LOG_DIR = resolve(process.env.LOG_DIR || '.cache/telemetry-debug');
const events: Array<{ receivedAt: string; [key: string]: unknown }> = [];

await mkdir(LOG_DIR, { recursive: true });

const server = createServer(async (req, res) => {
  // POST /event-log — receive a telemetry event
  if (req.method === 'POST' && req.url === '/event-log') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const eventType = data.eventType || 'unknown';
        const entry = { receivedAt: new Date().toISOString(), ...data };
        events.push(entry);

        if (matchesFilter(eventType)) {
          console.log(`\n\x1b[1;32m[telemetry] ${eventType}\x1b[0m`);
          const logged = hideMetadata ? { ...data, metadata: undefined } : data;
          console.log(JSON.stringify(logged, null, 2));
        }

        await writeFile(
          resolve(LOG_DIR, `events-${new Date().toISOString().slice(0, 10)}.jsonl`),
          JSON.stringify(entry) + '\n',
          { flag: 'a' }
        );

        res.statusCode = 200;
        res.end('OK');
      } catch {
        res.statusCode = 400;
        res.end('bad json');
      }
    });
    return;
  }

  // GET /event-log — return all events (used by event-log-checker)
  if (req.method === 'GET' && req.url === '/event-log') {
    console.log(`Sending ${events.length} events`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(events));
    return;
  }

  // GET /events or GET /events/:type — return all or filtered events
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
  console.log(`Event log collector listening on http://localhost:${PORT}/event-log`);
  console.log(`GET http://localhost:${PORT}/events to see all received events`);
  console.log(`GET http://localhost:${PORT}/events/<type> to filter by event type`);
  if (includeRegex) console.log(`Including only events matching: ${includePattern}`);
  if (excludeRegex) console.log(`Excluding events matching: ${excludePattern}`);
  console.log(`Logs written to ${LOG_DIR}`);
});
