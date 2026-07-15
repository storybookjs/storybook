import { LINUX_ROOT_DIR, SANDBOX_DIR, WINDOWS_ROOT_DIR, WORKING_DIR } from './constants.ts';
import { type JobOrNoOpJob, type Workflow } from './types.ts';

/**
 * The `Persisting to workspace` step is bytes-bound: CircleCI gzips the
 * workspace layer single-threaded at roughly 20MB/s, so ~2.5GB of
 * node_modules dominated the step regardless of file count (measured: packing
 * the trees into a plain tar left persist at 140s). Pre-compressing makes
 * CircleCI's own compression and every downstream download proportionally
 * cheaper. No executor image ships a zstd CLI (cimg/node, playwright,
 * machine - verified via step diagnostics), but stock Node >= 22.15 exposes
 * zstd through node:zlib, so scripts/ci/zstd-stream.mjs runs it straight from
 * the git checkout, before (and without) node_modules. zstd level 3 both
 * compresses better and runs faster than `gzip -1`.
 */
export const PACKED_NODE_MODULES_ARCHIVE = 'workspace-node_modules.tar.zst';

const ZSTD_STREAM = `${WORKING_DIR}/scripts/ci/zstd-stream.mjs`;

/**
 * The generated sandboxes get the same treatment: they are mostly
 * node_modules, so persisting them raw pays the same single-threaded workspace
 * compression cost on the create job and again on every downstream attach.
 */
export const sandboxArchive = (id: string) => `workspace-sandbox-${id}.tar.gz`;

export const workspace = {
  attach: (at = LINUX_ROOT_DIR) => {
    return {
      attach_workspace: {
        at,
      },
    };
  },
  persist: (paths: string[], root = LINUX_ROOT_DIR) => {
    return {
      persist_to_workspace: {
        paths,
        root,
      },
    };
  },
  pack: (requiredPaths: string[], optionalPaths: string[], root = LINUX_ROOT_DIR) => {
    return {
      run: {
        name: 'Pack node_modules for workspace',
        working_directory: root,
        // Per-package node_modules only exist for packages with unhoistable
        // dependencies, so they are filtered at runtime; the root trees are
        // passed straight to tar so a missing one fails the job loudly.
        command: [
          'node --version',
          'optional=""',
          `for p in ${optionalPaths.join(' ')}; do`,
          '  if [ -e "$p" ]; then optional="$optional $p"; fi',
          'done',
          `tar --create ${requiredPaths.join(' ')} $optional | node ${ZSTD_STREAM} compress 3 > ${PACKED_NODE_MODULES_ARCHIVE}`,
          `ls -la ${PACKED_NODE_MODULES_ARCHIVE}`,
        ].join('\n'),
      },
    };
  },
  unpack: (root = LINUX_ROOT_DIR) => {
    return {
      run: {
        name: 'Unpack node_modules from workspace',
        working_directory: root,
        command: [
          'node --version',
          `node ${ZSTD_STREAM} decompress < ${PACKED_NODE_MODULES_ARCHIVE} | tar --extract`,
        ].join('\n'),
      },
    };
  },
  packSandbox: (id: string, root = LINUX_ROOT_DIR) => {
    return {
      run: {
        name: 'Pack sandbox for workspace',
        working_directory: root,
        // posix (pax) format keeps sub-second mtimes, which webpack's
        // filesystem cache snapshots compare against: the default gnu format
        // truncates them to whole seconds, invalidating the cache and turning
        // the sandbox's dev-server start into a full cold compile. atime and
        // ctime headers are dropped as they only add archive size.
        command: `tar --create --format=posix --pax-option=delete=atime,delete=ctime ${SANDBOX_DIR}/${id} | gzip -1 > ${sandboxArchive(id)}`,
      },
    };
  },
  unpackSandbox: (id: string, root = LINUX_ROOT_DIR) => {
    return {
      run: {
        name: 'Unpack sandbox from workspace',
        working_directory: root,
        // --no-same-owner matches attach_workspace semantics: extraction as
        // root (the Playwright image) must not preserve the create job's uid,
        // or git refuses to operate on the sandbox repo ("dubious ownership")
        // and the change-detection feature and its E2E tests break.
        command: `tar --extract --gzip --no-same-owner --file ${sandboxArchive(id)}`,
      },
    };
  },
};

export const cache = {
  attach: (keys: string[]) => {
    return {
      restore_cache: {
        keys,
      },
    };
  },
  persist: (paths: string[], key: string) => {
    return {
      save_cache: {
        paths,
        key,
      },
    };
  },
};

export const artifact = {
  persist: (path: string, destination: string) => {
    return {
      store_artifacts: {
        path,
        destination,
      },
    };
  },
};

export const git = {
  checkout: ({ forceHttps = false, shallow = true } = {}) => {
    const flags = [];
    if (shallow) {
      flags.push('--depth 1');
    } else {
      flags.push('--depth 500');
    }

    if (forceHttps) {
      flags.push('--config url."https://github.com/".insteadOf=ssh://git@github.com/');
      flags.push('--config url."https://github.com/".insteadOf=git@github.com:');
    }
    return {
      'git-shallow-clone/checkout_advanced': {
        clone_options: flags.join(' '),
      },
    };
  },
  check: () => {
    return {
      run: {
        name: 'Ensure no uncommitted changes',
        command: [
          'if [ -n "$(git status --porcelain)" ]; then',
          '  echo ""',
          '  echo "Uncommitted changes detected in the working tree. If the build generated files, run \`yarn task --task compile\` locally and commit them."',
          '  echo ""',
          '  git status --porcelain',
          '  git diff',
          '  exit 1',
          'fi',
        ].join('\n'),
      },
    };
  },
};

export const node = {
  installOnWindows: () => {
    return {
      run: {
        name: 'Install Node + Yarn',
        shell: 'powershell.exe',
        command: [
          '$nodeVersion = Get-Content .nvmrc | Select-Object -First 1',
          'nvm install $nodeVersion',
          'nvm use $nodeVersion',
          'corepack enable',
          'corepack prepare yarn@stable --activate',
        ].join('\n'),
      },
    };
  },
};

export const npm = {
  installScripts: () => {
    return {
      run: {
        name: 'Install scripts',
        command: 'yarn workspaces focus @storybook/scripts',
      },
    };
  },
  install: (appDir: string, pkgManager: string = 'yarn') => {
    return {
      'node/install-packages': {
        'app-dir': appDir,
        'pkg-manager': pkgManager,
        'cache-only-lockfile': true,
        // v2: the orb's v1 node_modules cache carries the same poisoned tree
        // as the v6 CACHE_KEYS entries (see above); its restore overlays
        // node_modules on top of the primary cache without overwriting.
        'cache-version': 'v2',
      },
    };
  },
  check: () => {
    return {
      run: {
        name: 'Check for dedupe',
        command: 'yarn dedupe --check',
      },
    };
  },
};

export function toId(name: string) {
  // replace all non-alphanumeric characters with a hyphen
  // trim leading and trailing hyphens
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const server = {
  wait: (ports: string[]) => {
    return {
      run: {
        name: 'Wait on servers',
        working_directory: `code`,
        command: ports.map((port) => `yarn wait-on tcp:127.0.0.1:${port}`).join('\n'),
      },
    };
  },
};

export const verdaccio = {
  start: () => {
    return {
      run: {
        name: 'Verdaccio',
        working_directory: `code`,
        background: true,
        command: 'yarn local-registry --open',
      },
    };
  },
  publish: () => {
    return {
      run: {
        name: 'Publish to Verdaccio',
        working_directory: `code`,
        command: 'yarn local-registry --publish',
      },
    };
  },
  ports: ['6001', '6002'],
};

export const workflow = {
  restoreLinux: ({
    sandboxId,
    ...checkoutOpts
  }: { forceHttps?: boolean; shallow?: boolean; sandboxId?: string } = {}) => [
    git.checkout(checkoutOpts),
    // Downstream jobs should consume precomputed outputs exclusively from the
    // pipeline workspace to avoid stale cache interference and trust gating.
    workspace.attach(),
    workspace.unpack(),
    ...(sandboxId ? [workspace.unpackSandbox(sandboxId)] : []),
  ],
  restoreWindows: (at = WINDOWS_ROOT_DIR, checkoutOpts: { shallow?: boolean } = {}) => [
    git.checkout({ ...checkoutOpts, forceHttps: true }),
    node.installOnWindows(),
    workspace.attach(at),
    /**
     * I really wish this wasn't needed, but it is. I tried a lot of things to get it to not be
     * needed, but ultimately, something kept failing. At this point I gave up:
     * https://app.circleci.com/pipelines/github/storybookjs/storybook/110923/workflows/50076187-a5a7-4955-bff4-30bf9aec465c/jobs/976355
     *
     * So if you see a way to debug/solve those failing tests, please do so.
     */
    {
      run: {
        name: 'Install dependencies',
        command: 'yarn install',
      },
    },
  ],
  cancelOnFailure: () => {
    return [
      {
        run: {
          name: 'Cancel current workflow',
          when: 'on_fail',
          command:
            'curl -X POST --header "Content-Type: application/json" "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}/cancel?circle-token=${WORKFLOW_CANCELER}"',
        },
      },
    ];
  },
  reportOnFailure: (workflow: Workflow, template: string = 'none') => {
    return [
      {
        run: {
          name: 'Un-shallow git',
          when: 'on_fail',
          command: 'git fetch --unshallow',
        },
      },
      {
        run: {
          name: 'Report failure',
          when: 'on_fail',
          command: 'echo "Workflow failed"',
        },
      },
      {
        'discord/status': {
          only_for_branches: ['main', 'next', 'next-release', 'latest-release'].join(','),
          fail_only: true,
          failure_message: `$(yarn get-report-message ${workflow} ${template})`,
        },
      },
    ];
  },
};

export const CACHE_KEYS = (platform = 'linux') =>
  [
    `v7-${platform}-node_modules`,
    '{{ checksum ".nvmrc" }}',
    '{{ checksum ".yarnrc.yml" }}',
    '{{ checksum "yarn.lock" }}',
  ].map((_, index, list) => {
    return list.slice(0, list.length - index).join('/');
  });

export const CACHE_PATHS = [
  '.yarn/cache',
  '.yarn/unplugged',
  '.yarn/build-state.yml',
  '.yarn/root-install-state.gz',
  'node_modules',
  'code/node_modules',
  'scripts/node_modules',
];

export const testResults = {
  persist: (path: string) => {
    return {
      store_test_results: {
        path,
      },
    };
  },
};

/**
 * We ensure that if (due to filtering for example) any required jobs are not present in the todos
 * array, we add them back in. This is recursive, as a required job can have required jobs itself.
 */
export function ensureRequiredJobs(jobs: JobOrNoOpJob[]): JobOrNoOpJob[] {
  const results: JobOrNoOpJob[] = [];
  while (jobs.length > 0) {
    const job = jobs.shift();
    if (job) {
      if (results.find((r) => r.id === job.id)) {
        continue;
      }
      results.push(job);
      jobs.push(...job.requires);
    }
  }
  return results;
}
