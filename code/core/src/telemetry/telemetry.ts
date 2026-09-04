/// <reference types="node" />
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isCI } from 'storybook/internal/common';

import { nanoid } from 'nanoid';

import { version } from '../../package.json';
import { importMetaResolve, resolvePackageDir } from '../shared/utils/module.ts';
import { getAnonymousProjectId, getProjectSince } from './anonymous-id.ts';
import { detectAgent } from './detect-agent.ts';
import { set as saveToCache } from './event-cache.ts';
import { type PendingEvent, postEvent } from './post-event.ts';
import { getSessionId } from './session-id.ts';
import type { Options, TelemetryData, TelemetryEvent } from './types.ts';

const inFlight = new Map<string, PendingEvent>();
process.once('exit', handOffPendingEvents);

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

function getVersionNumber() {
  try {
    return JSON.parse(readFileSync(join(resolvePackageDir('storybook'), 'package.json'), 'utf8'))
      .version;
  } catch (e) {
    return version;
  }
}

export async function sendTelemetry(data: TelemetryData, options: Partial<Options> = {}) {
  const { eventType, payload, metadata, ...rest } = data;

  const context = options.stripMetadata
    ? globalContext
    : {
        ...globalContext,
        anonymousId: getAnonymousProjectId(),
        projectSince: getProjectSince()?.getTime(),
      };

  try {
    // The eventId lets the server de-duplicate an event that arrives more than once: a retry
    // after a timed-out response, or the detached process re-sending what this one had started.
    const body: TelemetryEvent = {
      ...rest,
      eventType,
      eventId: nanoid(),
      sessionId: getSessionId(),
      metadata,
      payload,
      context,
    };
    const event: PendingEvent = { body, retryDelay: options.retryDelay };
    const request = postEvent(event, { keepProcessAlive: options.immediate === true })
      .catch(() => {})
      .finally(() => inFlight.delete(body.eventId));

    inFlight.set(body.eventId, event);

    await Promise.all([options.immediate ? request : undefined, saveToCache(eventType, body)]);
  } catch (err) {
    //
  }
}

// Runs on process exit, where only synchronous work is possible: the events without a response
// go to a detached child that outlives this process and posts them.
export function handOffPendingEvents() {
  if (inFlight.size === 0) {
    return;
  }
  const events = [...inFlight.values()];
  inFlight.clear();
  const file = join(os.tmpdir(), `storybook-telemetry-${nanoid()}.json`);
  try {
    writeFileSync(file, JSON.stringify(events));
    const script = fileURLToPath(importMetaResolve('storybook/internal/telemetry/detached-flush'));
    spawn(process.execPath, [script, file], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  } catch {
    rmSync(file, { force: true });
  }
}
