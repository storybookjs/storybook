import { LINUX_ROOT_DIR, WINDOWS_ROOT_DIR } from './constants';
import { type JobOrNoOpJob, type Workflow } from './types';

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
        name: 'Ensure no changes pending',
        command: 'git diff --exit-code',
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
  restoreLinux: () => [
    //
    git.checkout(),
    workspace.attach(),
    cache.attach(CACHE_KEYS()),
  ],
  restoreWindows: (at = WINDOWS_ROOT_DIR) => [
    git.checkout({ forceHttps: true }),
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
          only_for_branches: ['main', 'next', 'next-release', 'latest-release'],
          fail_only: true,
          failure_message: `yarn get-report-message ${workflow} ${template}`,
        },
      },
    ];
  },
};

export const CACHE_KEYS = (platform = 'linux') =>
  [
    `v5-${platform}-node_modules`,
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
