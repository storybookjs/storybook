import { CACHE_KEYS } from './data';

export const ROOT_DIR = '/tmp';
export const WORKING_DIR = `project`;
export const SANDBOX_DIR = `storybook-sandboxes`;

export const workspace = {
  attach: (at = ROOT_DIR) => {
    return {
      attach_workspace: {
        at,
      },
    };
  },
  persist: (paths: string[], root = ROOT_DIR) => {
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
  unshallow: () => {
    return {
      run: {
        command: 'git fetch --unshallow',
        when: 'on_fail',
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

export const restore = {
  linux: () => [git.checkout(), workspace.attach(), cache.attach(CACHE_KEYS())],
  windows: () => [
    git.checkout({ forceHttps: true }),
    node.installOnWindows(),
    workspace.attach('C:\\Users\\circleci'),
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
};
