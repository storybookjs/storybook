import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectDeclaredNodeVersions,
  updateEnginesNode,
  updateNvmrc,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { handleUnsupportedNodeRuntime } from './node-version-check.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('semver', { spy: true });

describe('handleUnsupportedNodeRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  it('exits with error when no declared version files exist', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: undefined,
      nvmrcVersion: undefined,
      enginesNode: undefined,
      packageJsonPath: undefined,
    });

    await handleUnsupportedNodeRuntime(18, 0, 0);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('20.19+ or 22.12+'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Please upgrade and re-run'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('offers to bump .nvmrc when it is below minimum', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: '/project/.nvmrc',
      nvmrcVersion: '18.0.0',
      enginesNode: undefined,
      packageJsonPath: undefined,
    });
    vi.mocked(prompt.select).mockResolvedValue('22.12.0');
    vi.mocked(updateNvmrc).mockImplementation(() => {});

    await handleUnsupportedNodeRuntime(18, 0, 0);

    expect(prompt.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('.nvmrc'),
      })
    );
    expect(updateNvmrc).toHaveBeenCalledWith('/project/.nvmrc', '22.12.0');
  });

  it('shows context-aware exit message when .nvmrc was bumped', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: '/project/.nvmrc',
      nvmrcVersion: '18.0.0',
      enginesNode: undefined,
      packageJsonPath: undefined,
    });
    vi.mocked(prompt.select).mockResolvedValue('22.12.0');
    vi.mocked(updateNvmrc).mockImplementation(() => {});

    await handleUnsupportedNodeRuntime(18, 0, 0);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('.nvmrc has been updated to 22.12.0')
    );
  });

  it('shows generic exit message when user skips bump', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: '/project/.nvmrc',
      nvmrcVersion: '18.0.0',
      enginesNode: undefined,
      packageJsonPath: undefined,
    });
    vi.mocked(prompt.select).mockResolvedValue('skip');

    await handleUnsupportedNodeRuntime(18, 0, 0);

    expect(updateNvmrc).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Please upgrade and re-run'));
  });

  it('does not include current runtime in options (it is too old)', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: '/project/.nvmrc',
      nvmrcVersion: '18.0.0',
      enginesNode: undefined,
      packageJsonPath: undefined,
    });
    vi.mocked(prompt.select).mockResolvedValue('skip');

    await handleUnsupportedNodeRuntime(18, 0, 0);

    const selectCall = vi.mocked(prompt.select).mock.calls[0][0] as any;
    const labels = selectCall.options.map((o: any) => o.label);
    expect(labels).not.toEqual(
      expect.arrayContaining([expect.stringContaining('current runtime')])
    );
  });

  it('shows context-aware exit message when engines.node was bumped', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: undefined,
      nvmrcVersion: undefined,
      enginesNode: '>=16',
      packageJsonPath: '/project/package.json',
    });
    vi.mocked(prompt.select).mockResolvedValue('>=22.12');
    vi.mocked(updateEnginesNode).mockImplementation(() => {});

    await handleUnsupportedNodeRuntime(18, 0, 0);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('engines.node has been updated')
    );
  });

  it('always calls process.exit(1)', async () => {
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: undefined,
      nvmrcVersion: undefined,
      enginesNode: undefined,
      packageJsonPath: undefined,
    });

    await handleUnsupportedNodeRuntime(18, 0, 0);

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
