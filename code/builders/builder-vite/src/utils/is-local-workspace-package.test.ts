import { describe, expect, it, vi } from 'vitest';

import { getPackageName, isLocalWorkspacePackage } from './is-local-workspace-package';

const existsSyncMock = vi.fn();
const realpathSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => existsSyncMock(...args),
  realpathSync: (...args: any[]) => realpathSyncMock(...args),
}));

describe('getPackageName()', () => {
  it('should return unscoped package name', () => {
    expect(getPackageName('react')).toBe('react');
  });

  it('should return scoped package name', () => {
    expect(getPackageName('@storybook/addon-docs')).toBe('@storybook/addon-docs');
  });

  it('should strip deep import from unscoped package', () => {
    expect(getPackageName('react-dom/client')).toBe('react-dom');
  });

  it('should strip deep import from scoped package', () => {
    expect(getPackageName('@storybook/addon-docs/blocks')).toBe('@storybook/addon-docs');
  });

  it('should return outer package from transitive dep specifier', () => {
    expect(getPackageName('@storybook/addon-docs > @mdx-js/react')).toBe('@storybook/addon-docs');
  });

  it('should handle transitive dep with unscoped outer package', () => {
    expect(getPackageName('some-pkg > lodash')).toBe('some-pkg');
  });
});

describe('isLocalWorkspacePackage()', () => {
  const projectRoot = '/home/user/project';

  it('should return false when package does not exist in node_modules', () => {
    existsSyncMock.mockReturnValue(false);
    expect(isLocalWorkspacePackage('@storybook/addon-docs', projectRoot)).toBe(false);
  });

  it('should return true when package symlinks to inside project root (workspace package)', () => {
    existsSyncMock.mockReturnValue(true);
    // Symlink to workspace: node_modules/@storybook/addon-docs -> ../../addons/docs
    realpathSyncMock.mockReturnValue('/home/user/project/addons/docs' as any);
    expect(isLocalWorkspacePackage('@storybook/addon-docs', projectRoot)).toBe(true);
  });

  it('should return false when package is a regular node_modules installation', () => {
    existsSyncMock.mockReturnValue(true);
    // Regular installation: not a symlink, real path is inside node_modules
    realpathSyncMock.mockReturnValue(
      '/home/user/project/node_modules/@storybook/addon-docs' as any
    );
    expect(isLocalWorkspacePackage('@storybook/addon-docs', projectRoot)).toBe(false);
  });

  it('should return false when package is outside project root', () => {
    existsSyncMock.mockReturnValue(true);
    // Package in a different project's node_modules
    realpathSyncMock.mockReturnValue('/home/user/other-project/addons/docs' as any);
    expect(isLocalWorkspacePackage('@storybook/addon-docs', projectRoot)).toBe(false);
  });

  it('should return false when realpathSync throws', () => {
    existsSyncMock.mockReturnValue(true);
    realpathSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(isLocalWorkspacePackage('@storybook/addon-docs', projectRoot)).toBe(false);
  });
});
