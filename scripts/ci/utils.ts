export const ROOT_DIR = '/tmp';
export const WORKING_DIR = `storybook`;
export const SANDBOX_DIR = `storybook-sandboxes`;

export const workspace = {
  attach: () => {
    return {
      attach_workspace: {
        at: ROOT_DIR,
      },
    };
  },
  persist: (paths: string[]) => {
    return {
      persist_to_workspace: {
        paths,
        root: ROOT_DIR,
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
  checkout: (shallow: boolean = true) => {
    return {
      'git-shallow-clone/checkout_advanced': {
        clone_options: shallow ? '--depth 1' : '',
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
