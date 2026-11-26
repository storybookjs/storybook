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
import { getSessionId } from './session-id.ts';
import type { Options, TelemetryData, TelemetryEvent } from './types.ts';

const HAND_OVER_AFTER = 5_000;

const pending: TelemetryEvent[] = [];
let handOverTimer: ReturnType<typeof setTimeout> | undefined;
process.once('exit', handOverPendingEvents);

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
      sessionId: await getSessionId(),
      metadata,
      payload,
      context,
    };
    pending.push(body);
    // A long-running process may be killed without an exit event, so it does not keep its events.
    handOverTimer ??= setTimeout(handOverPendingEvents, HAND_OVER_AFTER).unref();

    await saveToCache(eventType, body);
  } catch (err) {
    //
  }
}

// Synchronous, because it also runs on process exit. A detached child outlives this process and
// posts the events, so this process never waits for the endpoint.
export function handOverPendingEvents() {
  clearTimeout(handOverTimer);
  handOverTimer = undefined;
  if (pending.length === 0) {
    return;
  }
  const events = pending.splice(0);
  const file = join(os.tmpdir(), `storybook-telemetry-${nanoid()}.json`);
  try {
    // The temp directory is shared between users on Linux: only the owner may read the events,
    // and an existing path, such as a planted symlink, is never written through.
    writeFileSync(file, JSON.stringify(events), { mode: 0o600, flag: 'wx' });
    const script = fileURLToPath(importMetaResolve('storybook/internal/telemetry/detached-flush'));
    const child = spawn(process.execPath, [script, file], {
      // With an inherited --inspect-brk the child would wait for a debugger forever.
      env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS?.replace(/--inspect\S*/g, '') },
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    // Without a listener, a spawn that fails later would crash a process that keeps running.
    child.on('error', () => {});
    child.unref();
    if (child.pid !== undefined) {
      return;
    }
  } catch {
    //
  }
  try {
    rmSync(file, { force: true });
  } catch {
    //
  }
}
