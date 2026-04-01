import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('empathic/find', { spy: true });
vi.mock('node:fs', { spy: true });

import {
  MIN_SUPPORTED_NODE_DESCRIPTION,
  detectDeclaredNodeVersions,
  formatMinVersion,
  isNodeVersionSupported,
  parseNodeVersionString,
  updateEnginesNode,
  updateNvmrc,
} from './node-version';

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
  });

  describe('parseNodeVersionString', () => {
    it('parses full version with v prefix', () => {
      expect(parseNodeVersionString('v22.14.2')).toEqual({ major: 22, minor: 14, patch: 2 });
    });

    it('parses full version without v prefix', () => {
      expect(parseNodeVersionString('22.14.2')).toEqual({ major: 22, minor: 14, patch: 2 });
    });

    it('parses major.minor (no patch)', () => {
      expect(parseNodeVersionString('20.19')).toEqual({ major: 20, minor: 19, patch: 0 });
    });

    it('parses bare major', () => {
      expect(parseNodeVersionString('18')).toEqual({ major: 18, minor: 0, patch: 0 });
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
      expect(parseNodeVersionString('  22.14.2\n')).toEqual({ major: 22, minor: 14, patch: 2 });
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
      expect(fsModule.writeFileSync).toHaveBeenCalledWith(
        '/project/.nvmrc',
        '22.12.0\n',
        'utf-8'
      );
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
      const originalContent = JSON.stringify(
        { name: 'my-app', engines: { npm: '>=8' } },
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
  });
});
