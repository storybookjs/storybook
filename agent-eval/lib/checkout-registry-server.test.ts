import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'checkout-registry-server.mjs'
);
// Per process, so parallel runs of this file in other checkouts don't collide.
const PORT = 40_000 + (process.pid % 10_000);

const cleanups: (() => void)[] = [];

function published(name: string, distTags: Record<string, string>, versions: string[]) {
  return {
    name,
    'dist-tags': distTags,
    versions: Object.fromEntries(versions.map((version) => [version, { name, version }])),
  };
}

// Starts a registry that serves the checkout build of `storybook`, in front of a fake npm.
async function startRegistry(
  port: number,
  version: string,
  upstreamPackuments: Record<string, unknown>
): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'checkout-registry-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'package'));
  writeFileSync(
    path.join(dir, 'package', 'package.json'),
    JSON.stringify({ name: 'storybook', version, bin: './bin.js' })
  );
  execFileSync('tar', ['-czf', path.join(dir, 'storybook.tgz'), '-C', dir, 'package']);
  writeFileSync(
    path.join(dir, 'registry.json'),
    JSON.stringify({
      version,
      tarballs: { storybook: 'storybook.tgz' },
      workspacePackages: ['storybook', '@storybook/addon-themes', 'create-storybook'],
    })
  );

  const upstream = createServer((req, res) => {
    const packument = upstreamPackuments[decodeURIComponent(req.url?.slice(1) ?? '')];
    res.writeHead(packument ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(packument ?? {}));
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => upstream.close());

  const registry = spawn(process.execPath, [SCRIPT, dir, String(port)], {
    env: {
      ...process.env,
      CHECKOUT_REGISTRY_UPSTREAM: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    },
    stdio: 'inherit',
  });
  cleanups.push(() => registry.kill());

  const url = `http://127.0.0.1:${port}`;
  await vi.waitUntil(
    () =>
      fetch(`${url}/-/ping`).then(
        (response) => response.ok,
        () => false
      ),
    { timeout: 10_000 }
  );
  return url;
}

afterAll(() => {
  cleanups.forEach((cleanup) => cleanup());
});

describe('the checkout registry', () => {
  let REGISTRY: string;

  beforeAll(async () => {
    const distTags = { latest: '10.6.1', next: '11.0.0-alpha.4' };
    REGISTRY = await startRegistry(PORT, '11.0.0-alpha.4', {
      storybook: published('storybook', distTags, ['10.6.1', '11.0.0-alpha.4', '11.0.0-alpha.5']),
      '@storybook/addon-themes': published('@storybook/addon-themes', distTags, [
        '10.6.1',
        '11.0.0-alpha.4',
      ]),
    });
  });

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

  it('answers with an empty packument for a package neither it nor npm has', async () => {
    const packument = await (await fetch(`${REGISTRY}/create-storybook`)).json();

    expect(packument).toMatchObject({ name: 'create-storybook', versions: {}, 'dist-tags': {} });
  });

  it('redirects every other request to the upstream registry', async () => {
    const response = await fetch(`${REGISTRY}/react`, { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/react$/);
  });
});

describe('the checkout registry once the stable release is on the major of the checkout', () => {
  let REGISTRY: string;

  beforeAll(async () => {
    REGISTRY = await startRegistry(PORT + 10_000, '11.1.0-alpha.0', {
      storybook: published(
        'storybook',
        { latest: '11.0.2', next: '11.1.0-alpha.0', v10: '10.6.5' },
        ['10.6.5', '11.0.2', '11.1.0-alpha.0']
      ),
    });
  });

  it('publishes the checkout build under the latest tag too', async () => {
    const packument = await (await fetch(`${REGISTRY}/storybook`)).json();

    expect(packument['dist-tags']).toEqual({
      latest: '11.1.0-alpha.0',
      next: '11.1.0-alpha.0',
      v10: '10.6.5',
    });
    expect(Object.keys(packument.versions)).toEqual(['10.6.5', '11.0.2', '11.1.0-alpha.0']);
    expect(packument.versions['11.1.0-alpha.0'].dist.tarball).toBe(
      `${REGISTRY}/-/checkout/storybook.tgz`
    );
  });
});
