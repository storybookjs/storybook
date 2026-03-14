import { exec } from 'node:child_process';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import type { Server } from 'node:http';
import { hostname } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';

import { program } from 'commander';
import pLimit from 'p-limit';
import picocolors from 'picocolors';
import { parseConfigFile, runServer } from 'verdaccio';

import { npmAuth } from './npm-auth';
import { maxConcurrentTasks } from './utils/concurrency';
import { PACKS_DIRECTORY, ROOT_DIRECTORY } from './utils/constants';
import { isPortUsed, killPort } from './utils/port';
import { getCodeWorkspaces } from './utils/workspace';

program
  .option('-O, --open', 'keep process open')
  .option('-P, --publish', 'should publish packages');

program.parse(process.argv);

const logger = console;

const root = resolvePath(__dirname, '..');

const opts = program.opts();
const registryInstanceId = `${hostname()}:${process.pid}:${Date.now()}`;
const registryStartedAt = new Date().toISOString();

const getEnvContext = () => ({
  ci: process.env.CI ?? null,
  githubRunId: process.env.GITHUB_RUN_ID ?? null,
  githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  githubJob: process.env.GITHUB_JOB ?? null,
  runnerName: process.env.RUNNER_NAME ?? null,
  runnerOs: process.env.RUNNER_OS ?? null,
  hostEnv: process.env.HOSTNAME ?? null,
  nxCiExecutionId: process.env.NX_CI_EXECUTION_ID ?? null,
  nxBase: process.env.NX_BASE ?? null,
  nxHead: process.env.NX_HEAD ?? null,
});

const getPortState = async () => ({
  proxyPortUsed: await isPortUsed(6001),
  verdaccioPortUsed: await isPortUsed(6002),
});

const serializeError = (error: unknown) =>
  error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 6).join('\n') ?? null,
      }
    : { message: String(error) };

const logRegistry = (event: string, extra: Record<string, unknown> = {}) => {
  logger.log(
    `[run-registry] ${JSON.stringify({
      event,
      at: new Date().toISOString(),
      registryInstanceId,
      registryStartedAt,
      pid: process.pid,
      host: hostname(),
      cwd: process.cwd(),
      open: !!opts.open,
      publish: !!opts.publish,
      env: getEnvContext(),
      ...extra,
    })}`
  );
};

const logRegistryWithPorts = async (event: string, extra: Record<string, unknown> = {}) => {
  logRegistry(event, { ...extra, ports: await getPortState() });
};

const pathExists = async (p: string) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

type Servers = { close: () => Promise<void>; reused?: boolean };

const startVerdaccio = async () => {
  await logRegistryWithPorts('startVerdaccio.begin');

  // Kill Verdaccio related processes if they are already running
  await killPort(6001);
  await killPort(6002);
  await logRegistryWithPorts('startVerdaccio.portsCleared');

  const ready = {
    proxy: false,
    verdaccio: false,
  };
  return Promise.race([
    new Promise<Servers>((resolve, reject) => {
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
        if (req.url === '/__registry-meta') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              registryInstanceId,
              registryStartedAt,
              pid: process.pid,
              host: hostname(),
              ready,
              env: getEnvContext(),
            })
          );
          return;
        }

        // if request contains "storybook" redirect to verdaccio
        if (req.url?.includes('storybook') || req.url?.includes('/sb') || req.method === 'PUT') {
          res.writeHead(302, { Location: 'http://localhost:6002' + req.url });
          res.end();
        } else {
          // forward to npm registry
          res.writeHead(302, { Location: 'https://registry.npmjs.org' + req.url });
          res.end();
        }
      });

      proxy.on('error', (error) => {
        logRegistry('startVerdaccio.proxy.error', { error: serializeError(error) });
        reject(error);
      });

      let verdaccioApp: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

      const servers = {
        close: async () => {
          await logRegistryWithPorts('startVerdaccio.close.begin');
          await Promise.all([
            new Promise<void>((resolve) => {
              verdaccioApp?.close(() => resolve());
            }),
            new Promise<void>((resolve) => {
              proxy?.close(() => resolve());
            }),
          ]);
          await logRegistryWithPorts('startVerdaccio.close.done');
        },
      };

      proxy.listen(6001, () => {
        ready.proxy = true;
        void logRegistryWithPorts('startVerdaccio.proxy.ready', { ready: { ...ready } });
        if (ready.verdaccio) {
          resolve(servers);
        }
      });
      const cache = join(__dirname, '..', '.verdaccio-cache');
      const config = {
        ...parseConfigFile(join(__dirname, 'verdaccio.yaml')),
        self_path: cache,
      };

      // @ts-expect-error (verdaccio's interface is wrong)
      runServer(config)
        .then((app: Server) => {
          verdaccioApp = app;

          app.listen(6002, () => {
            ready.verdaccio = true;
            void logRegistryWithPorts('startVerdaccio.verdaccio.ready', {
              ready: { ...ready },
            });
            if (ready.proxy) {
              resolve(servers);
            }
          });
        })
        .catch((error) => {
          logRegistry('startVerdaccio.runServer.error', { error: serializeError(error) });
          reject(error);
        });
    }),
    new Promise((_, rej) => {
      setTimeout(() => {
        if (!ready.verdaccio || !ready.proxy) {
          void logRegistryWithPorts('startVerdaccio.timeout', { ready: { ...ready } });
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

const publish = async (packages: { name: string; location: string }[], url: string) => {
  logger.log(`Publishing packages with a concurrency of ${maxConcurrentTasks}`);

  const limit = pLimit(maxConcurrentTasks);
  let i = 0;

  /**
   * We need to "pack" our packages before publishing to npm because our package.json files contain
   * yarn specific version "ranges". such as "workspace:*"
   *
   * We can't publish to npm if the package.json contains these ranges. So with `yarn pack` we
   * create a tarball that we can publish.
   *
   * However this bug exists in NPM: https://github.com/npm/cli/issues/4533! Which causes the NPM
   * CLI to disregard the tarball CLI argument and instead re-create a tarball. But NPM doesn't
   * replace the yarn version ranges.
   *
   * So we create the tarball ourselves and move it to another location on the FS. Then we
   * change-directory to that directory and publish the tarball from there.
   */
  await mkdir(PACKS_DIRECTORY, { recursive: true }).catch(() => {});

  return Promise.all(
    packages.map(({ name, location }) =>
      limit(
        () =>
          new Promise((resolve, reject) => {
            const loggedLocation = location.replace(resolvePath(join(__dirname, '..')), '.');
            const resolvedLocation = resolvePath('../code', location);

            logger.log(`🛫 publishing ${name} (${loggedLocation})`);

            const tarballFilename = `${name.replace('@', '').replace('/', '-')}.tgz`;
            const command = `cd "${resolvedLocation}" && yarn pack --out="${PACKS_DIRECTORY}/${tarballFilename}" && cd "${PACKS_DIRECTORY}" && npm publish "./${tarballFilename}" --registry ${url} --force --tag="xyz" --ignore-scripts`;
            exec(command, (e) => {
              if (e) {
                reject(e);
              } else {
                i += 1;
                logger.log(`${i}/${packages.length} 🛬 successful publish of ${name}!`);
                resolve(undefined);
              }
            });
          })
      )
    )
  );
};

let servers: Servers | undefined;

const run = async () => {
  const verdaccioUrl = `http://localhost:6001`;
  await logRegistryWithPorts('run.begin');

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
  await logRegistryWithPorts('run.beforeStartVerdaccio');

  const [_servers, packages, version] = await Promise.all([
    startVerdaccio(),
    getCodeWorkspaces(false),
    currentVersion(),
  ]);
  servers = _servers;
  await logRegistryWithPorts('run.afterStartVerdaccio', {
    packageCount: packages.length,
    version,
  });

  logger.log(`🌿 verdaccio running on ${verdaccioUrl}`);

  logger.log(`👤 add temp user to verdaccio`);
  await logRegistry('run.beforeNpmAuth');
  // Use npmAuth helper to authenticate to the local Verdaccio registry
  // This will create a .npmrc file in the root directory
  await npmAuth({
    username: 'foo',
    password: 's3cret',
    email: 'test@test.com',
    registry: 'http://localhost:6002',
    outputDir: root,
  });
  await logRegistry('run.afterNpmAuth');

  logger.log(
    `📦 found ${packages.length} storybook packages at version ${picocolors.blue(version)}`
  );

  if (opts.publish) {
    await logRegistry('run.beforePublish', { packageCount: packages.length, version });
    try {
      await publish(packages, 'http://localhost:6002');
      await logRegistry('run.afterPublish', { packageCount: packages.length, version });
    } finally {
      await rm(join(root, '.npmrc'), { force: true });
    }
  }

  if (!opts.open) {
    await logRegistry('run.beforeClose');
    await servers?.close();
    process.exit(0);
  }
  await logRegistry('run.openAndIdle', { verdaccioUrl });
};

run().catch(async (e) => {
  try {
    await logRegistryWithPorts('run.error', { error: serializeError(e) });
    await servers?.close();
  } finally {
    await rm(join(root, '.npmrc'), { force: true });
    throw e;
  }
});
