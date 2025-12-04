import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { program } from 'commander';
import pLimit from 'p-limit';
import picocolors from 'picocolors';
import { x } from 'tinyexec';
import type { PackageJson } from 'type-fest';
import { parseConfigFile, runServer } from 'verdaccio';

import { maxConcurrentTasks } from './utils/concurrency';
import { CODE_DIRECTORY, ROOT_DIRECTORY } from './utils/constants';
import { killPort } from './utils/port';
import { getCodeWorkspaces } from './utils/workspace';

const PUBLISH_TAG = 'local';
const RUN_ID = Date.now();

const REGISTRY_PORT = 6001;
const VERDACCIO_PORT = 6002;

program
  .option('-O, --open', 'keep process open')
  .option('-P, --publish', 'should publish packages')
  .option(
    '--local',
    'publish unique local version such as 10.2.0-alpha.1-local.1764865413053',
    true
  );

program.parse(process.argv);

const logger = console;

const opts = program.opts();

const pathExists = async (p: string) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

type Servers = { close: () => Promise<void> };
const startVerdaccio = async () => {
  // Kill Verdaccio related processes if they are already running
  await killPort(REGISTRY_PORT);
  await killPort(VERDACCIO_PORT);

  const packages = await getCodeWorkspaces(false);
  const ready = {
    proxy: false,
    verdaccio: false,
  };
  return Promise.race([
    new Promise((resolve) => {
      /**
       * The proxy server will sit in front of verdaccio and tunnel traffic to either verdaccio or
       * the actual npm global registry We do this because tunneling all traffic through verdaccio
       * is slow (this might get fixed in verdaccio) With this heuristic we get the best of both
       * worlds:
       *
       * - Verdaccio for storybook packages (including unscoped packages such as `storybook` and `sb`)
       * - Npm global registry for all other packages
       * - The best performance for both
       *
       * The proxy server listens on port 6001 and verdaccio on port 6002
       *
       * If you want to access the verdaccio UI, you can do so by visiting http://localhost:6002
       */
      const proxy = http.createServer((req, res) => {
        // if request contains "storybook" redirect to verdaccio
        if (
          req.url === '/' ||
          packages.some((it) => decodeURIComponent(req.url)?.startsWith('/' + it.name)) ||
          req.method === 'PUT'
        ) {
          res.writeHead(302, { Location: `http://localhost:${VERDACCIO_PORT}` + req.url });
          res.end();
        } else {
          // forward to npm registry
          res.writeHead(302, { Location: 'https://registry.npmjs.org' + req.url });
          res.end();
        }
      });

      let verdaccioApp: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

      const servers = {
        close: async () => {
          console.log(`🛬 Closing servers running on port ${REGISTRY_PORT} and ${VERDACCIO_PORT}`);
          await Promise.all([
            new Promise<void>((resolve) => {
              verdaccioApp?.close(() => resolve());
            }),
            new Promise<void>((resolve) => {
              proxy?.close(() => resolve());
            }),
          ]);
        },
      };

      proxy.listen(REGISTRY_PORT, () => {
        ready.proxy = true;
        if (ready.verdaccio) {
          resolve(servers);
        }
      });
      const cache = join(__dirname, '..', '.verdaccio-cache');
      const config = {
        ...parseConfigFile(join(__dirname, 'verdaccio.yaml')),
        self_path: cache,
      };

      runServer(config).then((app: Server) => {
        verdaccioApp = app;

        app.listen(VERDACCIO_PORT, () => {
          ready.verdaccio = true;
          if (ready.proxy) {
            resolve(servers);
          }
        });
      });
    }),
    new Promise((_, rej) => {
      setTimeout(() => {
        if (!ready.verdaccio || !ready.proxy) {
          rej(new Error(`TIMEOUT - verdaccio didn't start within 10s`));
        }
      }, 10000);
    }),
  ]) as Promise<Servers>;
};

const currentVersion = async () => {
  const content = await readFile(join(__dirname, '..', 'code', 'package.json'), 'utf-8');
  const { version } = JSON.parse(content);
  return version;
};

interface Package {
  name: string;
  location: string;
  path: string;
  version: string;
  publishVersion: string;
}

const publishPackage = async (ws: Package, workspaces: Package[]) => {
  const info = workspaces.find((it) => it.name === ws.name);
  const tmpDir = await mkdtemp(join(tmpdir(), ws.name.replace('/', '-') + '-'));

  await cp(ws.path, tmpDir, { recursive: true, force: true });

  const pkg = JSON.parse(await readFile(join(tmpDir, 'package.json'), 'utf8'));
  pkg.version = info.publishVersion;
  resolveWorkspaceDeps(pkg, workspaces);

  await writeFile(join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
  await writeFile(join(tmpDir, '.npmrc'), `//localhost:${VERDACCIO_PORT}/:_authToken=fake`);

  try {
    await x(
      'npm',
      [
        'publish',
        '--registry',
        `http://localhost:${VERDACCIO_PORT}`,
        '--tag',
        PUBLISH_TAG,
        '--ignore-scripts',
      ],
      { nodeOptions: { cwd: tmpDir, stdio: 'inherit' }, throwOnError: true }
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};

// Resolve workspace dependencies to the published version
const resolveWorkspaceDeps = (pkg: PackageJson, packages: Package[]) => {
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const) {
    const deps = pkg[field];
    if (!deps) {
      continue;
    }

    for (const [depName, raw] of Object.entries(deps)) {
      if (typeof raw !== 'string' || !raw.startsWith('workspace:')) {
        continue;
      }
      const info = packages.find((it) => it.name === depName);
      if (!info) {
        continue;
      }
      const spec = raw.slice('workspace:'.length);
      const version = info.publishVersion;
      deps[depName] = spec === '^' || spec === '~' ? `${spec}${version}` : version;
    }
  }
};

const getPackages = async () =>
  Promise.all(
    (await getCodeWorkspaces(false)).map(async (ws) => {
      const path = join(CODE_DIRECTORY, ws.location);
      const pkg = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
      const version = pkg.version;
      return {
        ...ws,
        path,
        version,
        publishVersion: opts.local ? `${version}-${PUBLISH_TAG}.${RUN_ID}` : version,
      };
    })
  );

let servers: Servers | undefined;

const run = async () => {
  const verdaccioUrl = `http://localhost:6001`;

  logger.log(`📐 reading version of storybook`);
  logger.log(`🚛 listing storybook packages`);

  if (opts.publish) {
    // when running e2e locally, clear cache to avoid EPUBLISHCONFLICT errors
    const verdaccioCache = join(ROOT_DIRECTORY, '.verdaccio-cache');
    if (await pathExists(verdaccioCache)) {
      logger.log(`🗑 cleaning up cache`);
      await rm(verdaccioCache, { force: true, recursive: true });
    }
  }

  logger.log(`🎬 starting verdaccio (this takes ±5 seconds, so be patient)`);

  const [_servers, packages, version] = await Promise.all([
    startVerdaccio(),
    getPackages(),
    currentVersion(),
  ]);
  servers = _servers;

  logger.log(`🌿 verdaccio running on ${verdaccioUrl}`);

  logger.log(
    `📦 found ${packages.length} storybook packages at version ${picocolors.blue(version)}`
  );

  if (opts.publish) {
    const limit = pLimit(maxConcurrentTasks);
    await Promise.all(packages.map((p) => limit(() => publishPackage(p, packages))));
  }

  if (!opts.open) {
    await servers?.close();
    process.exit(0);
  }
};

run().catch(async (e) => {
  try {
    await servers?.close();
  } finally {
    throw e;
  }
});
