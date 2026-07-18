/// <reference types="node" />
import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';

import { isCI } from 'storybook/internal/common';

import retry from 'fetch-retry';
import { nanoid } from 'nanoid';

import { version } from '../../package.json';
import { resolvePackageDir } from '../shared/utils/module.ts';
import { getAnonymousProjectId, getProjectSince } from './anonymous-id.ts';
import { detectAgent } from './detect-agent.ts';
import { set as saveToCache } from './event-cache.ts';
import { fetch } from './fetch.ts';
import { getSessionId } from './session-id.ts';
import type { Options, TelemetryData } from './types.ts';

const retryingFetch = retry(fetch);

const URL = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';

let tasks: Promise<any>[] = [];

export const addToGlobalContext = (key: string, value: any) => {
  globalContext[key] = value;
};

const getOperatingSystem = (): 'Windows' | 'macOS' | 'Linux' | `Other: ${string}` | 'Unknown' => {
  try {
    const platform = os.platform();

    if (platform === 'win32') {
      return 'Windows';
    }
    if (platform === 'darwin') {
      return 'macOS';
    }
    if (platform === 'linux') {
      return 'Linux';
    }

    return `Other: ${platform}`;
  } catch (_err) {
    return 'Unknown';
  }
};

// context info sent with all events, provided
// by the app. currently:
// - cliVersion
const inCI = isCI();
const agentDetection = detectAgent();
const globalContext = {
  inCI,
  isTTY: process.stdout.isTTY,
  agent: agentDetection,
  platform: getOperatingSystem(),
  nodeVersion: process.versions.node,
  storybookVersion: getVersionNumber(),
} as Record<string, any>;

const prepareRequest = async (data: TelemetryData, context: Record<string, any>, options: any) => {
  const { eventType, payload, metadata, ...rest } = data;
  const sessionId = await getSessionId();
  const eventId = nanoid();
  const body = { ...rest, eventType, eventId, sessionId, metadata, payload, context };
  const signal = AbortSignal.timeout(30_000);
  const maxRetries = 3;

  return retryingFetch(URL, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    retryDelay: (attempt: number) =>
      2 ** attempt *
      (typeof options?.retryDelay === 'number' && !Number.isNaN(options?.retryDelay)
        ? options.retryDelay
        : 1000),
    retryOn: (attempt, error, response) => {
      // If explicitly aborted (e.g. by the timeout above), or if we've exhausted our retries, give up.
      if (signal.aborted || attempt >= maxRetries) {
        return false;
      }

      // Retry transient network errors and server-overload responses.
      return Boolean(error) || response?.status === 503 || response?.status === 504;
    },
    signal,
  });
};

function getVersionNumber() {
  try {
    return JSON.parse(readFileSync(join(resolvePackageDir('storybook'), 'package.json'), 'utf8'))
      .version;
  } catch (e) {
    return version;
  }
}

export async function sendTelemetry(
  data: TelemetryData,
  options: Partial<Options> = { retryDelay: 1000, immediate: false }
) {
  const { eventType, payload, metadata, ...rest } = data;

  // We use this id so we can de-dupe events that arrive at the index multiple times due to the
  // use of retries. There are situations in which the request "5xx"s (or times-out), but
  // the server actually gets the request and stores it anyway.

  // flatten the data before we send it

  const context = options.stripMetadata
    ? globalContext
    : {
        ...globalContext,
        anonymousId: getAnonymousProjectId(),
        projectSince: getProjectSince()?.getTime(),
      };

  let request: any;
  try {
    request = prepareRequest(data, context, options);
    tasks.push(request);

    const sessionId = await getSessionId();
    const eventId = nanoid();
    const body = { ...rest, eventType, eventId, sessionId, metadata, payload, context };

    const waitFor = options.immediate ? tasks : [request];
    await Promise.all([...waitFor, saveToCache(eventType, body)]);
  } catch (err) {
    //
  } finally {
    tasks = tasks.filter((task) => task !== request);
  }
}
