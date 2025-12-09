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
    const configs = forceHttps
      ? [
          '--config url."https://github.com/".insteadOf=ssh://git@github.com/',
          '--config url."https://github.com/".insteadOf=git@github.com:',
        ].join(' ')
      : '';

    const depth = shallow ? '--depth 1' : '';

    return {
      'git-shallow-clone/checkout_advanced': {
        clone_options: `${depth} ${configs}`.trim(),
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
