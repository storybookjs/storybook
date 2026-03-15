import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { hostname } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'path';
import waitOn from 'wait-on';

import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants';
import { exec } from './utils/exec';
import { isPortUsed } from './utils/port';

process.setMaxListeners(50);

const {
  values: { link, template },
} = parseArgs({
  options: {
    template: { type: 'string' },
    link: { type: 'boolean', default: true },
  },
  allowNegative: true,
});

const logger = console;

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

const shellEscape = (value: string) => `"${value.replace(/(["\\$`])/g, '\\$1')}"`;

const getDiskSnapshot = (...paths: string[]) => {
  try {
    const existingPaths = paths.filter(Boolean).filter((path) => existsSync(path));
    const commands = ['df -h .', 'df -i .'];

    if (existingPaths.length > 0) {
      commands.push(`du -sh ${existingPaths.map(shellEscape).join(' ')} 2>/dev/null || true`);
    }

    return execSync(commands.join(' && '), {
      cwd: ROOT_DIRECTORY,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
      .trim()
      .split('\n');
  } catch (error) {
    return [`disk snapshot failed: ${serializeError(error).message}`];
  }
};

const getRegistryMeta = async () => {
  try {
    const response = await fetch('http://localhost:6001/__registry-meta');
    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      body: text,
    };
  } catch (error) {
    return {
      ok: false,
      error: serializeError(error),
    };
  }
};

const logPrepareSandbox = (event: string, extra: Record<string, unknown> = {}) => {
  logger.log(
    `[prepare-sandbox] ${JSON.stringify({
      event,
      at: new Date().toISOString(),
      pid: process.pid,
      host: hostname(),
      cwd: process.cwd(),
      env: getEnvContext(),
      ...extra,
    })}`
  );
};

const logPrepareSandboxWithPorts = async (event: string, extra: Record<string, unknown> = {}) => {
  logPrepareSandbox(event, { ...extra, ports: await getPortState() });
};

async function main() {
  if (!template) {
    throw new Error('Missing required --template option for prepare-sandbox.');
  }
  const templateDir = template.replace('/', '-');

  const sandboxDir = join(SANDBOX_DIRECTORY, templateDir);
  const cacheDir = join(ROOT_DIRECTORY, 'sandbox', templateDir);
  await logPrepareSandboxWithPorts('main.begin', {
    template,
    link,
    templateDir,
    sandboxDir,
    cacheDir,
    hasNodeModules: existsSync(join(sandboxDir, 'node_modules')),
    disk: getDiskSnapshot(cacheDir, sandboxDir),
  });

  if (!existsSync(join(sandboxDir, 'node_modules'))) {
    if (sandboxDir !== cacheDir) {
      await logPrepareSandbox('cache.copy.begin', { sandboxDir, cacheDir });
      console.log(`🧹 copying cached ${cacheDir} to ${sandboxDir}`);
      await rm(sandboxDir, { recursive: true, force: true });
      if (!existsSync(join(cacheDir))) {
        throw new Error(
          `Sandbox should exist at ${cacheDir}. Did you forget to run the sandbox command first?`
        );
      }
      // cache dir is created in the sandbox command that should be run before this script
      await cp(cacheDir, sandboxDir, { recursive: true, force: true });
      await logPrepareSandbox('cache.copy.done', {
        sandboxDir,
        cacheDir,
        sandboxExists: existsSync(sandboxDir),
        disk: getDiskSnapshot(cacheDir, sandboxDir),
      });
    }

    if (!link) {
      const waitStartedAt = Date.now();
      await logPrepareSandboxWithPorts('registry.wait.begin', { sandboxDir, cacheDir });
      try {
        await waitOn({
          log: true,
          resources: ['http://localhost:6001', 'http://localhost:6002'],
          interval: 16,
          timeout: 10000,
        });
        await logPrepareSandboxWithPorts('registry.wait.done', {
          durationMs: Date.now() - waitStartedAt,
          registryMeta: await getRegistryMeta(),
        });
      } catch (error) {
        await logPrepareSandboxWithPorts('registry.wait.failed', {
          durationMs: Date.now() - waitStartedAt,
          error: serializeError(error),
          registryMeta: await getRegistryMeta(),
        });
        throw error;
      }
    }

    await logPrepareSandbox('yarn.install.begin', {
      sandboxDir,
      disk: getDiskSnapshot(cacheDir, sandboxDir),
    });
    try {
      await exec('yarn install --immutable', { cwd: sandboxDir }, { debug: true });
      await logPrepareSandbox('yarn.install.done', {
        sandboxDir,
        disk: getDiskSnapshot(cacheDir, sandboxDir),
      });
    } catch (error) {
      await logPrepareSandbox('yarn.install.failed', {
        sandboxDir,
        error: serializeError(error),
        disk: getDiskSnapshot(cacheDir, sandboxDir),
      });
      throw error;
    }
  }

  if (template.includes('svelte-kit')) {
    await logPrepareSandbox('svelte-kit.sync.begin', { sandboxDir });
    try {
      await exec('yarn exec svelte-kit sync', { cwd: sandboxDir }, { debug: true });
      await logPrepareSandbox('svelte-kit.sync.done', { sandboxDir });
    } catch (error) {
      await logPrepareSandbox('svelte-kit.sync.failed', {
        sandboxDir,
        error: serializeError(error),
      });
      throw error;
    }
  }

  const storybookStaticSandboxDir = join(sandboxDir, 'storybook-static');
  const storybookStaticCacheDir = join(cacheDir, 'storybook-static');

  if (existsSync(storybookStaticCacheDir) && !existsSync(storybookStaticSandboxDir)) {
    await logPrepareSandbox('storybook-static.copy.begin', {
      storybookStaticCacheDir,
      storybookStaticSandboxDir,
    });
    console.log(`🧹 copying cached ${storybookStaticCacheDir} to ${storybookStaticSandboxDir}`);
    await cp(storybookStaticCacheDir, storybookStaticSandboxDir, {
      recursive: true,
      force: true,
    });
    await logPrepareSandbox('storybook-static.copy.done', {
      storybookStaticCacheDir,
      storybookStaticSandboxDir,
    });
  }

  await logPrepareSandboxWithPorts('main.done', {
    template,
    sandboxDir,
    hasNodeModules: existsSync(join(sandboxDir, 'node_modules')),
    disk: getDiskSnapshot(cacheDir, sandboxDir),
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
