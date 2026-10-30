import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import getPort from 'detect-port';
import { join } from 'pathe';
import polka from 'polka';
import { stringify } from 'telejson';
import { WebSocket } from 'ws';

import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';
import { createStorybook, type Storybook } from 'storybook/internal/instance';
import { projectService } from './__fixtures__/two-dev-servers/addons.ts';
import { buildDevStandalone } from './build-dev.ts';
import type { RuntimeInstanceRecord } from './utils/runtime-instance-registry.ts';

vi.unmock('@storybook/core/internal/node-logger');

const HOSTS: Awaited<ReturnType<typeof buildDevStandalone>>[] = [];
const INSTANCES: Storybook[] = [];
const SOCKETS: WebSocket[] = [];
const DIRECTORIES: string[] = [];
const WORKING_DIRS = ['alpha', 'beta'].map((name) =>
  fileURLToPath(new URL(`./__fixtures__/two-dev-servers/${name}`, import.meta.url))
);

afterEach(async () => {
  SOCKETS.splice(0).forEach((socket) => socket.terminate());
  await Promise.all(HOSTS.splice(0).map((host) => host.close()));
  await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
  await Promise.all(
    DIRECTORIES.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
  vi.unstubAllGlobals();
});

async function readRecords(directory: string): Promise<RuntimeInstanceRecord[]> {
  const names = await readdir(directory);
  return Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .map(
        async (name) =>
          JSON.parse(await readFile(join(directory, name), 'utf8')) as RuntimeInstanceRecord
      )
  );
}

function channelUrl(port: number, token: string): string {
  return `ws://127.0.0.1:${port}/storybook-server-channel?token=${encodeURIComponent(token)}`;
}

describe('two real Storybook projects in one process', () => {
  it('loads native projects and compiles their real managers without listening', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'storybook-two-managers-'));
    DIRECTORIES.push(outputDir);
    const managersCompiled: boolean[] = [];
    for (const workingDir of WORKING_DIRS) {
      const storybook = createStorybook({
        workingDir,
        configDir: '.storybook',
        mode: 'dev',
        cliOptions: { disableTelemetry: true, test: true, quiet: true, outputDir },
      });
      INSTANCES.push(storybook);
      await storybook.ready();
      const manager = createManagerHost(storybook);
      try {
        const server = createServer();
        const result = await runWithStorybook(storybook, () =>
          manager.dev({
            router: polka({ server }),
            server,
            startTime: process.hrtime(),
          })
        );
        managersCompiled.push(result.stats !== undefined);
      } finally {
        await manager.bail();
      }
    }
    const [alpha, beta] = INSTANCES;
    const indexes = await Promise.all(
      INSTANCES.map(async (storybook) => Object.keys((await storybook.getIndex()).entries))
    );
    const projects = await Promise.all(
      INSTANCES.map((storybook) =>
        storybook.services.get(projectService.id).commands.name(undefined)
      )
    );
    await alpha.close();
    const observed = {
      indexes,
      projects,
      workingDirs: INSTANCES.map(
        (storybook, index) => storybook.workingDir === WORKING_DIRS[index]
      ),
      managersCompiled,
      betaAfterAlphaClose: await beta.services.get(projectService.id).commands.name(undefined),
    };
    expect(observed).toMatchInlineSnapshot(`
      {
        "betaAfterAlphaClose": "beta",
        "indexes": [
          [
            "alpha--example",
          ],
          [
            "beta--example",
          ],
        ],
        "managersCompiled": [
          true,
          true,
        ],
        "projects": [
          "alpha",
          "beta",
        ],
        "workingDirs": [
          true,
          true,
        ],
      }
    `);
  });

  it('isolates HTTP, authenticated WebSockets, registry records, and shutdown', async () => {
    vi.stubGlobal('FEATURES', {});
    const registryDir = await mkdtemp(join(tmpdir(), 'storybook-two-dev-servers-'));
    DIRECTORIES.push(registryDir);
    for (const workingDir of WORKING_DIRS) {
      const port = await getPort(0);
      HOSTS.push(
        await buildDevStandalone({
          workingDir,
          configDir: '.storybook',
          port,
          exactPort: true,
          host: '127.0.0.1',
          ci: true,
          quiet: true,
          open: false,
          versionUpdates: false,
          disableTelemetry: true,
          test: true,
          runtimeRegistryDir: registryDir,
        })
      );
    }
    const [alpha, beta] = HOSTS;
    const indexes = await Promise.all(
      HOSTS.map(async ({ port }) => {
        const response = await fetch(`http://127.0.0.1:${port}/index.json`);
        return { status: response.status, ids: Object.keys((await response.json()).entries) };
      })
    );
    const records = await readRecords(registryDir);
    const alphaRecord = records.find((record) => record.port === alpha.port)!;
    const betaRecord = records.find((record) => record.port === beta.port)!;
    const services = await Promise.all(
      HOSTS.map(({ storybook }) =>
        storybook.services.get(projectService.id).commands.name(undefined)
      )
    );

    const rejected = new WebSocket(channelUrl(beta.port, alphaRecord.token!));
    SOCKETS.push(rejected);
    const unauthorized = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Token rejection timed out.')), 5000);
      rejected.once('close', () => clearTimeout(timeout));
      rejected.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode!);
      });
      rejected.once('error', reject);
      rejected.once('open', () => reject(new Error('The other project accepted the token.')));
    });
    const rejectedStatus = await unauthorized;
    rejected.terminate();

    const alphaSocket = new WebSocket(channelUrl(alpha.port, alphaRecord.token!));
    const betaSocket = new WebSocket(channelUrl(beta.port, betaRecord.token!));
    SOCKETS.push(alphaSocket, betaSocket);
    await Promise.all(
      [alphaSocket, betaSocket].map((socket) =>
        once(socket, 'open', { signal: AbortSignal.timeout(5000) })
      )
    );
    const alphaEvents: string[] = [];
    const betaEvents: string[] = [];
    alpha.storybook.channel.on('fixture:isolation', (value: string) => alphaEvents.push(value));
    beta.storybook.channel.on('fixture:isolation', (value: string) => betaEvents.push(value));
    alphaSocket.send(
      stringify({ type: 'fixture:isolation', args: ['alpha'], from: 'fixture-client' })
    );
    await vi.waitFor(() => expect(alphaEvents).toEqual(['alpha']));
    const betaBarrier = once(betaSocket, 'pong', { signal: AbortSignal.timeout(5000) });
    betaSocket.ping();
    await betaBarrier;
    const alphaClosed = once(alphaSocket, 'close', { signal: AbortSignal.timeout(5000) });
    await alpha.close();
    await alphaClosed;
    const alphaConnectionRefused = await fetch(`http://127.0.0.1:${alpha.port}/index.json`).then(
      () => false,
      () => true
    );
    const remainingRecords = await readRecords(registryDir);
    const betaIndex = await fetch(`http://127.0.0.1:${beta.port}/index.json`).then((response) =>
      response.json()
    );
    const betaService = await beta.storybook.services
      .get(projectService.id)
      .commands.name(undefined);
    const betaClosed = once(betaSocket, 'close', { signal: AbortSignal.timeout(5000) });
    await beta.close();
    await betaClosed;
    const observed = {
      portsDiffer: alpha.port !== beta.port,
      indexes,
      services,
      tokensPresent: records.every(
        (record) => typeof record.token === 'string' && record.token.length > 0
      ),
      tokensDiffer: alphaRecord.token !== betaRecord.token,
      rejectedStatus,
      channelEvents: { alpha: alphaEvents, beta: betaEvents },
      registry: {
        count: records.length,
        idsDiffer: alphaRecord.instanceId !== betaRecord.instanceId,
        portsMatch:
          records
            .map((record) => record.port)
            .sort()
            .join() === [alpha.port, beta.port].sort().join(),
        workingDirsMatch: records.every((record) =>
          WORKING_DIRS.some((directory) => directory === record.cwd)
        ),
        configDirsMatch: records.every((record) =>
          WORKING_DIRS.some((directory) => join(directory, '.storybook') === record.configDir)
        ),
        sameProcess: records.every((record) => record.pid === process.pid),
      },
      afterAlpha: {
        connectionRefused: alphaConnectionRefused,
        socketClosed: alphaSocket.readyState === WebSocket.CLOSED,
        recordsOnlyBeta:
          remainingRecords.length === 1 && remainingRecords[0].instanceId === betaRecord.instanceId,
        betaIndex: Object.keys(betaIndex.entries),
        betaService,
      },
      afterBeta: {
        records: await readRecords(registryDir),
        socketClosed: betaSocket.readyState === WebSocket.CLOSED,
      },
    };
    expect(observed).toMatchInlineSnapshot(`
      {
        "afterAlpha": {
          "betaIndex": [
            "beta--example",
          ],
          "betaService": "beta",
          "connectionRefused": true,
          "recordsOnlyBeta": true,
          "socketClosed": true,
        },
        "afterBeta": {
          "records": [],
          "socketClosed": true,
        },
        "channelEvents": {
          "alpha": [
            "alpha",
          ],
          "beta": [],
        },
        "indexes": [
          {
            "ids": [
              "alpha--example",
            ],
            "status": 200,
          },
          {
            "ids": [
              "beta--example",
            ],
            "status": 200,
          },
        ],
        "portsDiffer": true,
        "registry": {
          "configDirsMatch": true,
          "count": 2,
          "idsDiffer": true,
          "portsMatch": true,
          "sameProcess": true,
          "workingDirsMatch": true,
        },
        "rejectedStatus": 401,
        "services": [
          "alpha",
          "beta",
        ],
        "tokensDiffer": true,
        "tokensPresent": true,
      }
    `);
  }, 60000);
});
