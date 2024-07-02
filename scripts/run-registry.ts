import { execaCommand } from 'execa';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
import path from 'path';
import program from 'commander';
import http from 'http';

import { runServer, parseConfigFile } from 'verdaccio';
import pLimit from 'p-limit';
import type { Server } from 'http';
import { mkdir } from 'fs/promises';
import { PACKS_DIRECTORY } from './utils/constants';

import { maxConcurrentTasks } from './utils/concurrency';
import { getWorkspaces } from './utils/workspace';
import { execa, execaSync } from 'execa';

program
  .option('-O, --open', 'keep process open')
  .option('-P, --publish', 'should publish packages');

program.parse(process.argv);

const logger = console;

const dirname = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(__dirname, '..');

const startVerdaccio = async () => {
  const ready = {
    proxy: false,
    verdaccio: false,
  };
  return Promise.race([
    new Promise((resolve) => {
      /** The proxy server will sit in front of verdaccio and tunnel traffic to either verdaccio or the actual npm global registry
       * We do this because tunneling all traffic through verdaccio is slow (this might get fixed in verdaccio)
       * With this heuristic we get the best of both worlds:
       * - verdaccio for storybook packages (including unscoped packages such as `storybook` and `sb`)
       * - npm global registry for all other packages
       * - the best performance for both
       *
       * The proxy server listens on port 6001 and verdaccio on port 6002
       *
       * If you want to access the verdaccio UI, you can do so by visiting http://localhost:6002
       */
      const proxy = http.createServer((req, res) => {
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

      let verdaccioApp: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

      proxy.listen(6001, () => {
        ready.proxy = true;
        if (ready.verdaccio) {
          resolve(verdaccioApp);
        }
      });
      const cache = path.join(dirname, '..', '.verdaccio-cache');
      const config = {
        ...parseConfigFile(path.join(dirname, 'verdaccio.yaml')),
        self_path: cache,
      };

      // @ts-expect-error (verdaccio's interface is wrong)
      runServer(config).then((app: Server) => {
        verdaccioApp = app;

        app.listen(6002, () => {
          ready.verdaccio = true;
          if (ready.proxy) {
            resolve(verdaccioApp);
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
  ]) as Promise<Server>;
};

const currentVersion = async () => {
  const { version } = await fsExtra.readJSON(path.join(dirname, '..', 'code', 'package.json'));
  return version;
};

const publish = async (packages: { name: string; location: string }[], url: string) => {
  logger.log(`Publishing packages with a concurrency of ${maxConcurrentTasks}`);

  const limit = pLimit(maxConcurrentTasks);
  let i = 0;

  /**
   * We need to "pack" our packages before publishing to npm because our package.json files contain yarn specific version "ranges".
   * such as "workspace:*"
   *
   * We can't publish to npm if the package.json contains these ranges. So with `yarn pack` we create a tarball that we can publish.
   *
   * However this bug exists in NPM: https://github.com/npm/cli/issues/4533!
   * Which causes the NPM CLI to disregard the tarball CLI argument and instead re-create a tarball.
   * But NPM doesn't replace the yarn version ranges.
   *
   * So we create the tarball ourselves and move it to another location on the FS.
   * Then we change-directory to that directory and publish the tarball from there.
   */
  await mkdir(PACKS_DIRECTORY, { recursive: true }).catch(() => {});

  return Promise.all(
    packages.map(({ name, location }) =>
      limit(
        () =>
          new Promise<void>(async (res, rej) => {
            logger.log(
              `🛫 publishing ${name} (${location.replace(
                path.resolve(path.join(dirname, '..')),
                '.'
              )})`
            );

            const tarballFilename = `${name.replace('@', '').replace('/', '-')}.tgz`;
            const pathLocation = path.resolve('../code', location);
            try {
              await execaCommand(`yarn pack --out ${PACKS_DIRECTORY}/${tarballFilename}`, {
                cwd: pathLocation,
              });
              await execaCommand(
                `npm publish ${tarballFilename} --registry ${url} --force --ignore-scripts`,
                {
                  cwd: PACKS_DIRECTORY,
                }
              );
              i += 1;
              logger.log(`${i}/${packages.length} 🛬 successful publish of ${name}!`);
              res();
            } catch (e) {
              rej(e as any);
            }
          })
      )
    )
  );
};

const run = async () => {
  const verdaccioUrl = `http://localhost:6001`;

  logger.log(`📐 reading version of storybook`);
  logger.log(`🚛 listing storybook packages`);

  if (!process.env.CI) {
    // when running e2e locally, clear cache to avoid EPUBLISHCONFLICT errors
    const verdaccioCache = path.resolve(dirname, '..', '.verdaccio-cache');
    if (await fsExtra.pathExists(verdaccioCache)) {
      logger.log(`🗑 cleaning up cache`);
      await fsExtra.remove(verdaccioCache);
    }
  }

  logger.log(`🎬 starting verdaccio (this takes ±5 seconds, so be patient)`);

  const [verdaccioServer, packages, version] = await Promise.all([
    startVerdaccio(),
    getWorkspaces(false),
    currentVersion(),
  ]);

  logger.log(`🌿 verdaccio running on ${verdaccioUrl}`);

  logger.log(`👤 add temp user to verdaccio`);
  await execa(
    'npx',
    // creates a .npmrc file in the root directory of the project
    [
      'npm-auth-to-token',
      '-u',
      'foo',
      '-p',
      's3cret',
      '-e',
      'test@test.com',
      '-r',
      'http://localhost:6002',
    ],
    {
      cwd: root,
    }
  );

  logger.log(`📦 found ${packages.length} storybook packages at version ${chalk.blue(version)}`);

  if (program.publish) {
    await publish(packages, 'http://localhost:6002');
  }

  return new Promise<void>(async (res) => {
    await execa('npx', ['rimraf', '.npmrc'], { cwd: root });

    if (!program.open) {
      verdaccioServer.close(() => {
        res();
      });
    } else {
      res();
    }
  });
};

run().catch((e) => {
  logger.error(e);
  execaSync('npx', ['rimraf', '.npmrc'], { cwd: root });
  process.exit(1);
});
