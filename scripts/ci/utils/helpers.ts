import { BEFORE_SANDBOX_NPM_MIN_VERSION } from '../../utils/npm-constants.ts';
import { LINUX_ROOT_DIR, SANDBOX_DIR, WINDOWS_ROOT_DIR, WORKING_DIR } from './constants.ts';
import { type JobOrNoOpJob } from './types.ts';
import { getPnpmVersion } from './workspace.ts';

export const cancelWorkflowStep = {
  run: {
    name: 'Cancel current workflow',
    when: 'on_fail',
    command:
      'curl -X POST --header "Content-Type: application/json" "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}/cancel?circle-token=${WORKFLOW_CANCELER}"',
  },
};

export const compileStep = () => ({
  run: {
    name: 'Compile',
    working_directory: 'code',
    command: 'pnpm task --task compile --start-from=auto --no-link --debug',
  },
});

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
export const sandboxArchive = (id: string) => `workspace-sandbox-${id}.tar.zst`;

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
        name: 'Pack node_modules for workspace (background)',
        working_directory: root,
        // Runs in the background so the ~50s tar/zstd overlaps with Compile:
        // node_modules is final once install and the dedupe check pass, compile
        // only writes per-package dist/, and tar archives the workspace symlinks
        // under node_modules as symlink entries without reading through them.
        // The exit code lands in a status file (a plain failure would be
        // swallowed by the background shell); awaitPack() consumes it.
        background: true,
        // A workspace package without dependencies gets no node_modules, so
        // the per-package trees are filtered at runtime; the required trees
        // are passed straight to tar so a missing one fails the job loudly.
        // Compile writes caches into node_modules/.cache during the pack, and
        // tar fails on a file that changes while it reads it.
        command: [
          `rm -f ${PACKED_NODE_MODULES_ARCHIVE}.status`,
          'node --version',
          'optional=""',
          `for p in ${optionalPaths.join(' ')}; do`,
          '  if [ -e "$p" ]; then optional="$optional $p"; fi',
          'done',
          'status=1',
          `if tar --create --exclude=node_modules/.cache ${requiredPaths.join(' ')} $optional | node ${ZSTD_STREAM} compress 3 > ${PACKED_NODE_MODULES_ARCHIVE}; then`,
          '  status=0',
          'fi',
          `echo "$status" > ${PACKED_NODE_MODULES_ARCHIVE}.status`,
          `ls -la ${PACKED_NODE_MODULES_ARCHIVE}`,
        ].join('\n'),
      },
    };
  },
  awaitPack: (root = LINUX_ROOT_DIR) => {
    return {
      run: {
        name: 'Wait for node_modules pack',
        working_directory: root,
        // Join point for the backgrounded pack step: CircleCI kills background
        // processes when the job's last step ends and offers no built-in wait,
        // so this polls for the status file and propagates a pack failure. A
        // killed compressor surfaces as a nonzero pipeline status and a killed
        // shell as the poll timeout, so the archive check only needs to be the
        // free non-empty test, not a full decompression pass (measured at
        // ~22s of critical path on an xlarge executor with `gzip -t`).
        command: [
          'waited=0',
          `until [ -f ${PACKED_NODE_MODULES_ARCHIVE}.status ]; do`,
          '  if [ "$waited" -ge 300 ]; then',
          '    echo "Timed out waiting for the background node_modules pack" >&2',
          '    exit 1',
          '  fi',
          '  sleep 2',
          '  waited=$((waited + 2))',
          'done',
          `status=$(cat ${PACKED_NODE_MODULES_ARCHIVE}.status)`,
          'if [ "$status" != "0" ]; then',
          '  echo "Background node_modules pack failed with status $status" >&2',
          '  exit 1',
          'fi',
          `test -s ${PACKED_NODE_MODULES_ARCHIVE}`,
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
        command: [
          'node --version',
          `tar --create --format=posix --pax-option=delete=atime,delete=ctime ${SANDBOX_DIR}/${id} | node ${ZSTD_STREAM} compress 3 > ${sandboxArchive(id)}`,
          `ls -la ${sandboxArchive(id)}`,
        ].join('\n'),
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
        command: [
          'node --version',
          `node ${ZSTD_STREAM} decompress < ${sandboxArchive(id)} | tar --extract --no-same-owner`,
        ].join('\n'),
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

const DEEP_CHECKOUT = '--depth 100 --filter=blob:none';

export const git = {
  checkout: ({ forceHttps = false, shallow = true } = {}) => {
    const flags = [];
    if (shallow) {
      flags.push('--depth 1');
    } else {
      // Chromatic walks the commit graph for baselines and diffs trees for TurboSnap; the blobs of
      // 100 commits are most of the download and nothing in the job reads them.
      flags.push(DEEP_CHECKOUT);
    }

    if (forceHttps) {
      flags.push('--config url."https://github.com/".insteadOf=ssh://git@github.com/');
      flags.push('--config url."https://github.com/".insteadOf=git@github.com:');
    }
    return {
      'git-shallow-clone/checkout_advanced': {
        clone_options: flags.join(' '),
        // The orb's fetch defaults to `--depth 10`, which would cut the deep clone's history again.
        ...(shallow ? {} : { fetch_options: DEEP_CHECKOUT }),
        // On `pull/N/head` branches the orb's fetch defaults to `--tags`, which pulls every
        // release tag and its history and costs more than the clone itself.
        tag_fetch_options: '--no-tags',
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
          '  echo "Uncommitted changes detected in the working tree. If the build generated files, run \`pnpm task --task compile\` locally and commit them."',
          '  echo ""',
          '  git status --porcelain',
          '  git --no-pager diff',
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
        name: 'Install Node',
        shell: 'powershell.exe',
        command: [
          '$nodeVersion = Get-Content .nvmrc | Select-Object -First 1',
          'nvm install $nodeVersion',
          'nvm use $nodeVersion',
        ].join('\n'),
      },
    };
  },
};

export const npm = {
  installPinnedVersion: () => {
    return {
      run: {
        name: `Install npm ${BEFORE_SANDBOX_NPM_MIN_VERSION}`,
        // `sudo` resets PATH, so after a `node/install` step it would upgrade the system npm instead
        // of the one on PATH.
        command: [
          `if [ -w "$(npm root -g)" ]; then npm install -g npm@${BEFORE_SANDBOX_NPM_MIN_VERSION}; else sudo npm install -g npm@${BEFORE_SANDBOX_NPM_MIN_VERSION}; fi`,
          'npm --version',
        ].join('\n'),
      },
    };
  },
};

const PACKAGE_MANAGERS_DIR = '.github/actions/setup-node-and-install/package-managers';

export const installPackageManagers = (...tools: `pnpm=${string}`[]) =>
  `bash ${PACKAGE_MANAGERS_DIR}/install.sh ${tools.join(' ')}`;

export const pnpm = {
  enable: () => {
    return {
      run: {
        name: 'Enable pnpm',
        command: installPackageManagers(`pnpm=${getPnpmVersion()}`),
      },
    };
  },
  install: () => {
    return {
      run: {
        name: 'Install dependencies',
        command: 'pnpm install --frozen-lockfile',
      },
    };
  },
  dedupeCheck: () => {
    return {
      run: {
        name: 'Check for dedupe',
        command: 'pnpm dedupe --check',
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
        command: ports.map((port) => `pnpm exec wait-on tcp:127.0.0.1:${port}`).join('\n'),
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
        command: 'pnpm local-registry --open',
      },
    };
  },
  publish: () => {
    return {
      run: {
        name: 'Publish to Verdaccio',
        working_directory: `code`,
        command: 'pnpm local-registry --publish',
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
    pnpm.enable(),
    // Downstream jobs should consume precomputed outputs exclusively from the
    // pipeline workspace to avoid stale cache interference and trust gating.
    workspace.attach(),
    workspace.unpack(),
    ...(sandboxId ? [workspace.unpackSandbox(sandboxId)] : []),
  ],
  restoreWindows: (at = WINDOWS_ROOT_DIR, checkoutOpts: { shallow?: boolean } = {}) => [
    git.checkout({ ...checkoutOpts, forceHttps: true }),
    node.installOnWindows(),
    pnpm.enable(),
    workspace.attach(at),
    // The workspace holds no node_modules for Windows, where pnpm links them with junctions.
    pnpm.install(),
  ],
  cancelOnFailure: () => [cancelWorkflowStep],
};

/**
 * The one key `node_modules` may be restored from.
 *
 * A `node_modules` tree is a layout, not a set of downloads. Hence no fallback keys: either the tree
 * came from this exact lockfile, workspace config and pnpm, or it is installed again.
 */
export const NODE_MODULES_CACHE_KEY = () =>
  [
    'v12-linux-node_modules',
    `pnpm-${getPnpmVersion()}`,
    '{{ checksum ".nvmrc" }}',
    '{{ checksum "pnpm-workspace.yaml" }}',
    '{{ checksum "pnpm-lock.yaml" }}',
  ].join('/');

// The root node_modules holds pnpm's virtual store, from which `pnpm install` relinks every
// package's node_modules in seconds.
export const NODE_MODULES_CACHE_PATHS = ['node_modules'];

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
