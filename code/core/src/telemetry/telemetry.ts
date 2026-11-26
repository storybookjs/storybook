/// <reference types="node" />
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
import { getSessionId } from './session-id.ts';
import type { Options, TelemetryData, TelemetryEvent } from './types.ts';

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
    const body: TelemetryEvent = {
      ...rest,
      eventType,
      eventId: nanoid(),
      sessionId: getSessionId(),
      metadata,
      payload,
      context,
    };
    await Promise.all([handOver(body), saveToCache(eventType, body)]);
  } catch (err) {
    //
  }
}

// Resolves when the event is written. On Windows that is asynchronous, so an exit right after
// the call would lose the event.
async function handOver(event: TelemetryEvent) {
  try {
    // On globalThis, because this module can load more than once in one process. Every copy sends
    // an unchanged TelemetryEvent, which the child posts as it is.
    const sender = globalThis.SB_TELEMETRY_SENDER?.connected
      ? globalThis.SB_TELEMETRY_SENDER
      : (globalThis.SB_TELEMETRY_SENDER = startSender());
    await new Promise<void>((resolve) => sender.send(event, () => resolve()));
  } catch {
    //
  }
}

// A detached child posts the events, so this process never waits for the endpoint. The child
// exits by itself once this process is gone and its requests are done.
function startSender() {
  const script = fileURLToPath(importMetaResolve('storybook/internal/telemetry/sender'));
  const child = spawn(process.execPath, [script], {
    // With an inherited --inspect-brk the child would wait for a debugger forever.
    env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS?.replace(/--inspect\S*/g, '') },
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
  });
  // Without a listener, a spawn that fails later would crash this process.
  child.on('error', () => {});
  // Neither the child nor its channel may keep this process from exiting. Bun has no channel.unref.
  child.unref();
  child.channel?.unref?.();
  return child;
}
