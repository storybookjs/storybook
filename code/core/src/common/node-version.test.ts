import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('empathic/find', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('./utils/paths.ts', () => ({
  getProjectRoot: vi.fn(() => '/project'),
  invalidateProjectRootCache: vi.fn(),
}));

import {
  MIN_SUPPORTED_NODE_DESCRIPTION,
  detectDeclaredNodeVersions,
  formatMinVersion,
  isNodeVersionSupported,
  parseNodeVersionString,
  updateEnginesNode,
  updateNvmrc,
} from './node-version.ts';

describe('node-version', () => {
  describe('formatMinVersion', () => {
    it('formats major-only when minor and patch are 0', () => {
      expect(formatMinVersion({ major: 20, minor: 0, patch: 0 })).toBe('20+');
    });

    it('formats major.minor when patch is 0', () => {
      expect(formatMinVersion({ major: 20, minor: 19, patch: 0 })).toBe('20.19+');
    });

    it('formats major.minor.patch when patch is non-zero', () => {
      expect(formatMinVersion({ major: 22, minor: 22, patch: 1 })).toBe('22.22.1+');
    });
  });

  describe('isNodeVersionSupported', () => {
    describe('strict mode (default)', () => {
      it('accepts exact minimum version (20.19.0)', () => {
        expect(isNodeVersionSupported(20, 19, 0)).toBe(true);
      });

      it('accepts exact minimum version (22.12.0)', () => {
        expect(isNodeVersionSupported(22, 12, 0)).toBe(true);
      });

      it('rejects version below minimum minor (20.18.0)', () => {
        expect(isNodeVersionSupported(20, 18, 0)).toBe(false);
      });

      it('rejects version below minimum major (18.0.0)', () => {
        expect(isNodeVersionSupported(18, 0, 0)).toBe(false);
      });

      it('accepts version above minimum minor (20.20.0)', () => {
        expect(isNodeVersionSupported(20, 20, 0)).toBe(true);
      });

      it('rejects odd major between ranges (21.0.0)', () => {
        expect(isNodeVersionSupported(21, 0, 0)).toBe(false);
      });

      it('accepts future major above highest defined (24.0.0)', () => {
        expect(isNodeVersionSupported(24, 0, 0)).toBe(true);
      });

      it('rejects 22.11.0 (one minor below 22.12)', () => {
        expect(isNodeVersionSupported(22, 11, 0)).toBe(false);
      });

      it('accepts 22.12.1 (patch above minimum)', () => {
        expect(isNodeVersionSupported(22, 12, 1)).toBe(true);
      });

      it('rejects 19.99.99', () => {
        expect(isNodeVersionSupported(19, 99, 99)).toBe(false);
      });

      it('rejects major-only "22" (treated as 22.0.0 which is below 22.12)', () => {
        expect(isNodeVersionSupported(22, 0, 0)).toBe(false);
      });
    });

    describe('nvmrc mode', () => {
      it('accepts major-only "22" (latest 22.x is supported)', () => {
        expect(isNodeVersionSupported(22, 0, 0, { mode: 'nvmrc', precision: 'major' })).toBe(true);
      });

      it('accepts major-only "20" (latest 20.x is supported)', () => {
        expect(isNodeVersionSupported(20, 0, 0, { mode: 'nvmrc', precision: 'major' })).toBe(true);
      });

      it('rejects major-only "18" (no supported version exists for major 18)', () => {
        expect(isNodeVersionSupported(18, 0, 0, { mode: 'nvmrc', precision: 'major' })).toBe(false);
      });

      it('rejects major-only "21" (no supported version exists for major 21)', () => {
        expect(isNodeVersionSupported(21, 0, 0, { mode: 'nvmrc', precision: 'major' })).toBe(false);
      });

      it('accepts future major-only "24" (above highest defined major)', () => {
        expect(isNodeVersionSupported(24, 0, 0, { mode: 'nvmrc', precision: 'major' })).toBe(true);
      });

      it('accepts major.minor "22.14" (22.14 >= 22.12)', () => {
        expect(isNodeVersionSupported(22, 14, 0, { mode: 'nvmrc', precision: 'minor' })).toBe(true);
      });

      it('accepts major.minor "22.12" (exactly the minimum minor)', () => {
        expect(isNodeVersionSupported(22, 12, 0, { mode: 'nvmrc', precision: 'minor' })).toBe(true);
      });

      it('rejects major.minor "22.11" (22.11 < 22.12)', () => {
        expect(isNodeVersionSupported(22, 11, 0, { mode: 'nvmrc', precision: 'minor' })).toBe(
          false
        );
      });

      it('rejects major.minor "20.18" (20.18 < 20.19)', () => {
        expect(isNodeVersionSupported(20, 18, 0, { mode: 'nvmrc', precision: 'minor' })).toBe(
          false
        );
      });

      it('uses strict patch comparison when precision is patch', () => {
        expect(isNodeVersionSupported(22, 12, 0, { mode: 'nvmrc', precision: 'patch' })).toBe(true);
        expect(isNodeVersionSupported(22, 11, 9, { mode: 'nvmrc', precision: 'patch' })).toBe(
          false
        );
      });
    });
  });

  describe('parseNodeVersionString', () => {
    it('parses full version with v prefix', () => {
      expect(parseNodeVersionString('v22.14.2')).toEqual({
        major: 22,
        minor: 14,
        patch: 2,
        precision: 'patch',
      });
    });

    it('parses full version without v prefix', () => {
      expect(parseNodeVersionString('22.14.2')).toEqual({
        major: 22,
        minor: 14,
        patch: 2,
        precision: 'patch',
      });
    });

    it('parses major.minor (no patch)', () => {
      expect(parseNodeVersionString('20.19')).toEqual({
        major: 20,
        minor: 19,
        patch: 0,
        precision: 'minor',
      });
    });

    it('parses bare major', () => {
      expect(parseNodeVersionString('18')).toEqual({
        major: 18,
        minor: 0,
        patch: 0,
        precision: 'major',
      });
    });

    it('parses bare major-only supported version "22"', () => {
      expect(parseNodeVersionString('22')).toEqual({
        major: 22,
        minor: 0,
        patch: 0,
        precision: 'major',
      });
    });

    it('returns undefined for lts/*', () => {
      expect(parseNodeVersionString('lts/*')).toBeUndefined();
    });

    it('returns undefined for lts/hydrogen', () => {
      expect(parseNodeVersionString('lts/hydrogen')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(parseNodeVersionString('')).toBeUndefined();
    });

    it('handles whitespace and newlines', () => {
      expect(parseNodeVersionString('  22.14.2\n')).toEqual({
        major: 22,
        minor: 14,
        patch: 2,
        precision: 'patch',
      });
    });
  });

  describe('MIN_SUPPORTED_NODE_DESCRIPTION', () => {
    it('formats current minimums as human-readable string', () => {
      expect(MIN_SUPPORTED_NODE_DESCRIPTION).toBe('20.19+ or 22.12+');
    });
  });

  describe('detectDeclaredNodeVersions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('bounds .nvmrc search to project root to avoid picking up unrelated files', async () => {
      const findModule = await import('empathic/find');
      const fsModule = await import('node:fs');
      const pathsModule = await import('./utils/paths.ts');
      vi.mocked(pathsModule.getProjectRoot).mockReturnValue('/project');
      vi.mocked(findModule.up).mockReturnValue('/project/.nvmrc');
      vi.mocked(fsModule.readFileSync).mockImplementation((path: any) => {
        if (String(path) === '/project/.nvmrc') {
          return '20.19.0\n';
        }
        if (String(path) === '/project/package.json') {
          return JSON.stringify({});
        }
        return '';
      });

      detectDeclaredNodeVersions('/project');

      expect(findModule.up).toHaveBeenCalledWith('.nvmrc', {
        cwd: '/project',
        last: '/project',
      });
    });

    it('does not traverse above project root when searching for .nvmrc', async () => {
      const findModule = await import('empathic/find');
      const fsModule = await import('node:fs');
      const pathsModule = await import('./utils/paths.ts');
      // Simulate project root at /project, but .nvmrc only exists at /home/user
      vi.mocked(pathsModule.getProjectRoot).mockReturnValue('/project');
      vi.mocked(findModule.up).mockReturnValue(undefined as any);
      vi.mocked(fsModule.readFileSync).mockImplementation((path: any) => {
        if (String(path) === '/project/package.json') {
          return JSON.stringify({});
        }
        return '';
      });

      const result = detectDeclaredNodeVersions('/project');

      expect(result.nvmrcPath).toBeUndefined();
      expect(result.nvmrcVersion).toBeUndefined();
    });

    it('detects .nvmrc version', async () => {
      const findModule = await import('empathic/find');
      const fsModule = await import('node:fs');
      vi.mocked(findModule.up).mockReturnValue('/project/.nvmrc');
      vi.mocked(fsModule.readFileSync).mockImplementation((path: any) => {
        if (String(path) === '/project/.nvmrc') {
          return '18.0.0\n';
        }
        if (String(path) === '/project/package.json') {
          return JSON.stringify({});
        }
        return '';
      });

      const result = detectDeclaredNodeVersions('/project');
      expect(result.nvmrcPath).toBe('/project/.nvmrc');
      expect(result.nvmrcVersion).toBe('18.0.0');
    });

    it('detects engines.node from package.json', async () => {
      const findModule = await import('empathic/find');
      const fsModule = await import('node:fs');
      vi.mocked(findModule.up).mockReturnValue(undefined as any);
      vi.mocked(fsModule.readFileSync).mockImplementation((path: any) => {
        if (String(path) === '/project/package.json') {
          return JSON.stringify({ engines: { node: '>=16' } });
        }
        return '';
      });

      const result = detectDeclaredNodeVersions('/project');
      expect(result.nvmrcPath).toBeUndefined();
      expect(result.enginesNode).toBe('>=16');
      expect(result.packageJsonPath).toBe('/project/package.json');
    });

    it('returns empty when no .nvmrc and no engines', async () => {
      const findModule = await import('empathic/find');
      const fsModule = await import('node:fs');
      vi.mocked(findModule.up).mockReturnValue(undefined as any);
      vi.mocked(fsModule.readFileSync).mockImplementation((path: any) => {
        if (String(path).endsWith('package.json')) {
          return JSON.stringify({});
        }
        return '';
      });

      const result = detectDeclaredNodeVersions('/project');
      expect(result.nvmrcPath).toBeUndefined();
      expect(result.nvmrcVersion).toBeUndefined();
      expect(result.enginesNode).toBeUndefined();
    });

    it('handles missing package.json gracefully', async () => {
      const findModule = await import('empathic/find');
      const fsModule = await import('node:fs');
      vi.mocked(findModule.up).mockReturnValue(undefined as any);
      vi.mocked(fsModule.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = detectDeclaredNodeVersions('/project');
      expect(result.enginesNode).toBeUndefined();
    });
  });

  describe('updateNvmrc', () => {
    it('writes version string to file', async () => {
      const fsModule = await import('node:fs');
      vi.mocked(fsModule.writeFileSync).mockImplementation(() => {});
      updateNvmrc('/project/.nvmrc', '22.12.0');
      expect(fsModule.writeFileSync).toHaveBeenCalledWith('/project/.nvmrc', '22.12.0\n', 'utf-8');
    });
  });

  describe('updateEnginesNode', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('updates engines.node in package.json preserving formatting', async () => {
      const fsModule = await import('node:fs');
      const originalContent = JSON.stringify(
        { name: 'my-app', engines: { node: '>=16' } },
        null,
        2
      );
      vi.mocked(fsModule.readFileSync).mockReturnValue(originalContent);
      vi.mocked(fsModule.writeFileSync).mockImplementation(() => {});

      updateEnginesNode('/project/package.json', '>=22.12');

      expect(fsModule.writeFileSync).toHaveBeenCalledWith(
        '/project/package.json',
        expect.stringContaining('"node": ">=22.12"'),
        'utf-8'
      );
    });

    it('adds engines.node when engines object exists but node is missing', async () => {
      const fsModule = await import('node:fs');
      const originalContent = JSON.stringify({ name: 'my-app', engines: { npm: '>=8' } }, null, 2);
      vi.mocked(fsModule.readFileSync).mockReturnValue(originalContent);
      vi.mocked(fsModule.writeFileSync).mockImplementation(() => {});

      updateEnginesNode('/project/package.json', '>=22.12');

      expect(fsModule.writeFileSync).toHaveBeenCalledWith(
        '/project/package.json',
        expect.stringContaining('"node": ">=22.12"'),
        'utf-8'
      );
    });

    it('creates engines object when it does not exist', async () => {
      const fsModule = await import('node:fs');
      const originalContent = JSON.stringify({ name: 'my-app' }, null, 2);
      vi.mocked(fsModule.readFileSync).mockReturnValue(originalContent);
      vi.mocked(fsModule.writeFileSync).mockImplementation(() => {});

      updateEnginesNode('/project/package.json', '>=22.12');

      const writtenContent = vi.mocked(fsModule.writeFileSync).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.engines.node).toBe('>=22.12');
    });

    it('preserves tab indentation using detect-indent', async () => {
      const fsModule = await import('node:fs');
      const originalContent = '{\n\t"name": "my-app",\n\t"engines": {\n\t\t"node": ">=16"\n\t}\n}';
      vi.mocked(fsModule.readFileSync).mockReturnValue(originalContent);
      vi.mocked(fsModule.writeFileSync).mockImplementation(() => {});

      updateEnginesNode('/project/package.json', '>=22.12');

      const writtenContent = vi.mocked(fsModule.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('\t"engines"');
      expect(writtenContent).toContain('"node": ">=22.12"');
    });

    it('defaults to 2-space indent for minified JSON', async () => {
      const fsModule = await import('node:fs');
      const originalContent = '{"name":"my-app","engines":{"node":">=16"}}';
      vi.mocked(fsModule.readFileSync).mockReturnValue(originalContent);
      vi.mocked(fsModule.writeFileSync).mockImplementation(() => {});

      updateEnginesNode('/project/package.json', '>=22.12');

      const writtenContent = vi.mocked(fsModule.writeFileSync).mock.calls[0][1] as string;
      // Should expand to 2-space indent (the default) instead of staying minified
      expect(writtenContent).toContain('  "');
    });
  });
});
