import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'checkout-registry-server.mjs'
);
const PORT = 48731;
const REGISTRY = `http://127.0.0.1:${PORT}`;

const upstreamPackuments: Record<string, unknown> = {
  storybook: {
    name: 'storybook',
    'dist-tags': { latest: '10.6.1', next: '11.0.0-alpha.4' },
    versions: {
      '10.6.1': { name: 'storybook', version: '10.6.1' },
      '11.0.0-alpha.4': { name: 'storybook', version: '11.0.0-alpha.4' },
    },
  },
  '@storybook/addon-themes': {
    name: '@storybook/addon-themes',
    'dist-tags': { latest: '10.6.1', next: '11.0.0-alpha.4' },
    versions: {
      '10.6.1': { name: '@storybook/addon-themes', version: '10.6.1' },
      '11.0.0-alpha.4': { name: '@storybook/addon-themes', version: '11.0.0-alpha.4' },
    },
  },
};

let dir: string;
let upstream: Server;
let registry: ChildProcess;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'checkout-registry-'));
  mkdirSync(path.join(dir, 'package'));
  writeFileSync(
    path.join(dir, 'package', 'package.json'),
    JSON.stringify({ name: 'storybook', version: '11.0.0-alpha.4', bin: './bin.js' })
  );
  execFileSync('tar', ['-czf', path.join(dir, 'storybook.tgz'), '-C', dir, 'package']);
  writeFileSync(
    path.join(dir, 'registry.json'),
    JSON.stringify({
      version: '11.0.0-alpha.4',
      tarballs: { storybook: 'storybook.tgz' },
      workspacePackages: ['storybook', '@storybook/addon-themes', 'create-storybook'],
    })
  );

  upstream = createServer((req, res) => {
    const packument = upstreamPackuments[decodeURIComponent(req.url?.slice(1) ?? '')];
    res.writeHead(packument ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(packument ?? {}));
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));

  registry = spawn(process.execPath, [SCRIPT, dir, String(PORT)], {
    env: {
      ...process.env,
      CHECKOUT_REGISTRY_UPSTREAM: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    },
    stdio: 'inherit',
  });
  await vi.waitUntil(() =>
    fetch(`${REGISTRY}/-/ping`).then(
      (response) => response.ok,
      () => false
    )
  );
});

afterAll(() => {
  registry?.kill();
  upstream?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the checkout registry', () => {
  it('publishes the checkout build of a served package under the next tag', async () => {
    const packument = await (await fetch(`${REGISTRY}/storybook`)).json();

    expect(packument['dist-tags']).toEqual({ latest: '10.6.1', next: '11.0.0-alpha.4' });
    expect(Object.keys(packument.versions)).toEqual(['10.6.1', '11.0.0-alpha.4']);
    expect(packument.versions['11.0.0-alpha.4']).toMatchObject({
      bin: './bin.js',
      dist: {
        tarball: `${REGISTRY}/-/checkout/storybook.tgz`,
        integrity: expect.stringMatching(/^sha512-/),
      },
    });

    const tarball = await fetch(packument.versions['11.0.0-alpha.4'].dist.tarball);
    expect(tarball.status).toBe(200);
  });

  it('withholds the checkout version of a monorepo package it does not serve', async () => {
    const packument = await (await fetch(`${REGISTRY}/@storybook%2Faddon-themes`)).json();

    expect(packument['dist-tags']).toEqual({ latest: '10.6.1' });
    expect(Object.keys(packument.versions)).toEqual(['10.6.1']);
  });

  it('serves a package npm does not know yet', async () => {
    const packument = await (await fetch(`${REGISTRY}/create-storybook`)).json();

    expect(packument).toMatchObject({ name: 'create-storybook', versions: {}, 'dist-tags': {} });
  });

  it('redirects every other request to the upstream registry', async () => {
    const response = await fetch(`${REGISTRY}/react`, { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/react$/);
  });
});
