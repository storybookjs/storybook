// npm registry for the sandbox that publishes this checkout's Storybook packages under the `next`
// dist-tag and redirects every other request to the npm registry, so `npm create storybook@next`
// and `npx storybook@next upgrade` install the branch under test. Zero dependencies: it runs before
// the sandbox installs anything.
//
// Usage: node checkout-registry-server.mjs <dir> <port>, where <dir> holds registry.json and the
// tarballs.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const NPM_REGISTRY = process.env.CHECKOUT_REGISTRY_UPSTREAM ?? 'https://registry.npmjs.org';
const TARBALL_PATH = '/-/checkout/';

const [dir, port] = process.argv.slice(2);
const origin = `http://127.0.0.1:${port}`;
/** @type {{ version: string; tarballs: Record<string, string>; workspacePackages: string[] }} */
const config = JSON.parse(await readFile(join(dir, 'registry.json'), 'utf8'));
const checkoutMajor = majorOf(config.version);
const workspacePackages = new Set(config.workspacePackages);

const tarballs = new Map();
const manifests = new Map();
for (const [name, file] of Object.entries(config.tarballs)) {
  const tarball = await readFile(join(dir, file));
  tarballs.set(file, tarball);
  manifests.set(name, {
    ...JSON.parse(readTarEntry(gunzipSync(tarball), 'package/package.json')),
    dist: {
      tarball: `${origin}${TARBALL_PATH}${file}`,
      shasum: createHash('sha1').update(tarball).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
    },
  });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', origin);
    if (url.pathname === '/-/ping') {
      return send(res, 200, {});
    }
    if (url.pathname.startsWith(TARBALL_PATH)) {
      const tarball = tarballs.get(url.pathname.slice(TARBALL_PATH.length));
      if (!tarball) {
        return send(res, 404, { error: 'not found' });
      }
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(tarball);
    }
    const name = decodeURIComponent(url.pathname.slice(1));
    if (workspacePackages.has(name) && (req.method === 'GET' || req.method === 'HEAD')) {
      return send(res, 200, await packument(name, req.headers.accept));
    }
    // 307 keeps the method and body of npm's POST requests, such as the audit.
    res.writeHead(req.method === 'GET' || req.method === 'HEAD' ? 302 : 307, {
      location: `${NPM_REGISTRY}${req.url}`,
    });
    res.end();
  } catch (error) {
    send(res, 502, { error: String(error) });
  }
}).listen(Number(port), '127.0.0.1');

// The npm packument with the checkout's major version and up removed, so nothing at that version
// can come from the registry, plus the checkout build for the packages this registry serves.
async function packument(name, accept) {
  const response = await fetch(`${NPM_REGISTRY}/${name.replace('/', '%2F')}`, {
    headers: { accept: accept ?? 'application/json' },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`${name}: npm registry answered ${response.status}`);
  }
  const upstream = response.ok ? await response.json() : { name, versions: {}, 'dist-tags': {} };

  const versions = Object.fromEntries(
    Object.entries(upstream.versions ?? {}).filter(([version]) => majorOf(version) < checkoutMajor)
  );
  const distTags = Object.fromEntries(
    Object.entries(upstream['dist-tags'] ?? {}).filter(([, version]) => version in versions)
  );
  const manifest = manifests.get(name);
  if (manifest) {
    versions[manifest.version] = manifest;
    distTags.next = manifest.version;
  }
  return { ...upstream, versions, 'dist-tags': distTags };
}

function readTarEntry(tar, entryName) {
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = cString(header.subarray(0, 100));
    if (name === '') {
      break;
    }
    const prefix = cString(header.subarray(345, 500));
    const size = parseInt(cString(header.subarray(124, 136)).trim() || '0', 8);
    if ((prefix ? `${prefix}/${name}` : name) === entryName) {
      return tar.subarray(offset + 512, offset + 512 + size).toString('utf8');
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${entryName} not found in tarball`);
}

function cString(bytes) {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
}

function majorOf(version) {
  return Number.parseInt(version, 10);
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
