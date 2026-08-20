import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';
import * as walk from 'empathic/walk';
import { fs as memfs, vol } from 'memfs';

vi.mock('node:fs', { spy: true });
vi.mock('empathic/find', { spy: true });
vi.mock('../paths.ts', { spy: true });

import {
  findTsconfigPathForFile,
  findTsconfigPathForPath,
  getTsconfigPathsBaseDir,
} from '../tsconfig.ts';
import * as paths from '../paths.ts';

const PROJECT_ROOT = resolve('/workspace');

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as unknown as typeof readFileSync);
  vi.mocked(statSync).mockImplementation(memfs.statSync as unknown as typeof statSync);
  vi.mocked(find.up).mockImplementation((name, options) => {
    for (const dir of walk.up(options?.cwd ?? '', options)) {
      const candidate = join(dir, name);
      if (memfs.existsSync(candidate)) {
        return candidate;
      }
    }
  });
  vi.mocked(paths.getProjectRoot).mockReset();
});

afterEach(() => {
  vol.reset();
  vi.restoreAllMocks();
});

describe('findTsconfigPathForFile', () => {
  it('uses the referenced app tsconfig for Vite-style project references', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@ui/*': ['src/*'],
          },
        },
        include: ['src'],
      }),
      'tsconfig.node.json': JSON.stringify({
        include: ['vite.config.ts'],
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
  });

  it('keeps reference order for same-directory sibling tsconfigs that both match the file', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
        include: ['src'],
      }),
      'tsconfig.node.json': JSON.stringify({
        compilerOptions: {
          module: 'ESNext',
        },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
  });

  it('falls back to the nearest discovered tsconfig when no reference matches the file', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.json')
    );
  });

  it('reads referenced tsconfigs that use JSONC trailing commas', () => {
    const dir = createTempProject({
      'tsconfig.json': `{
        "files": [],
        "references": [
          { "path": "./tsconfig.app.json" },
        ],
      }`,
      'tsconfig.app.json': `{
        "compilerOptions": {
          "baseUrl": ".",
        },
        "include": ["src"],
      }`,
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
  });

  it('uses include globs inherited via extends from a nested autogen config', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        extends: './generated/autogen.tsconfig.json',
      }),
      'generated/autogen.tsconfig.json': JSON.stringify({
        include: ['../**/*.tsx'],
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.json')
    );
  });

  it('does not treat a referenced project as owning files outside its extended include', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        extends: './generated/autogen.tsconfig.json',
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'generated/autogen.tsconfig.json': JSON.stringify({
        include: ['../src/components/**/*.tsx'],
      }),
      'src/components/Button.tsx': 'export const Button = () => null;',
      'src/utils/helper.ts': 'export const helper = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/components/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
    // Without extends resolution, the app config would default to **/* and incorrectly own helper.ts.
    expect(findTsconfigPathForFile(dir, join(dir, 'src/utils/helper.ts'))).toBe(
      join(dir, 'tsconfig.json')
    );
  });

  it('lets a leaf include override an extended include', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        extends: './tsconfig.base.json',
        include: ['src/components'],
      }),
      'tsconfig.base.json': JSON.stringify({
        include: ['src'],
      }),
      'src/components/Button.tsx': 'export const Button = () => null;',
      'src/utils/helper.ts': 'export const helper = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/components/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
    expect(findTsconfigPathForFile(dir, join(dir, 'src/utils/helper.ts'))).toBe(
      join(dir, 'tsconfig.json')
    );
  });
});

describe('findTsconfigPathForPath', () => {
  it('does not dirname directories when resolving from an importer basedir', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
      'nested/tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'nested/src/Button.tsx': 'export const Button = () => null;',
    });

    // Directory input must search from that directory, not its parent.
    expect(findTsconfigPathForPath(join(dir, 'nested/src'))).toBe(
      join(dir, 'nested/tsconfig.json')
    );
    // File input still uses file-aware ownership.
    expect(findTsconfigPathForPath(join(dir, 'nested/src/Button.tsx'))).toBe(
      join(dir, 'nested/tsconfig.json')
    );
  });
});

describe('getTsconfigPathsBaseDir', () => {
  it('uses the parent config directory when paths are inherited without baseUrl', () => {
    const dir = createTempProject({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          paths: {
            '@tools/my-plugin': ['./tools/my-plugin/src'],
            '@tools/my-plugin/*': ['./tools/my-plugin/src/*'],
          },
        },
      }),
      'test-app/tsconfig.json': JSON.stringify({
        extends: '../tsconfig.base.json',
        compilerOptions: {
          module: 'esnext',
        },
      }),
    });

    expect(getTsconfigPathsBaseDir(join(dir, 'test-app/tsconfig.json'))).toBe(dir);
  });

  it('uses the resolved parent baseUrl when the parent defines both baseUrl and paths', () => {
    const dir = createTempProject({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@tools/my-plugin/*': ['./tools/my-plugin/src/*'],
          },
        },
      }),
      'test-app/tsconfig.json': JSON.stringify({
        extends: '../tsconfig.base.json',
      }),
    });

    expect(getTsconfigPathsBaseDir(join(dir, 'test-app/tsconfig.json'))).toBe(dir);
  });

  it('uses the leaf directory when a single tsconfig defines paths without baseUrl', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          paths: {
            '@lib/*': ['./src/lib/*'],
          },
        },
      }),
    });

    expect(getTsconfigPathsBaseDir(join(dir, 'tsconfig.json'))).toBe(dir);
  });

  it('resolves an explicit baseUrl relative to the config that defined it', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: 'src',
          paths: {
            '@/*': ['./*'],
          },
        },
      }),
    });

    expect(getTsconfigPathsBaseDir(join(dir, 'tsconfig.json'))).toBe(join(dir, 'src'));
  });

  it('uses the leaf directory when the child defines its own paths', () => {
    const dir = createTempProject({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          paths: {
            '@tools/*': ['./tools/*'],
          },
        },
      }),
      'test-app/tsconfig.json': JSON.stringify({
        extends: '../tsconfig.base.json',
        compilerOptions: {
          paths: {
            '@app/*': ['./src/*'],
          },
        },
      }),
    });

    expect(getTsconfigPathsBaseDir(join(dir, 'test-app/tsconfig.json'))).toBe(
      join(dir, 'test-app')
    );
  });
});

function createTempProject(files: Record<string, string>) {
  const json: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(files)) {
    json[join(PROJECT_ROOT, relativePath)] = content;
  }
  vol.fromJSON(json);
  vi.mocked(paths.getProjectRoot).mockReturnValue(PROJECT_ROOT);
  return PROJECT_ROOT;
}
