import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PREPARE_NON_PATCH_WORKFLOW_PATH,
  PREPARE_PATCH_WORKFLOW_PATH,
  run as cancelPreparationWorkflows,
} from '../cancel-preparation-runs';
import * as github_ from '../utils/github-client';

vi.mock('../utils/github-client');

const github = vi.mocked(github_);

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Cancel preparation runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    github.githubRestClient.mockImplementation(((route: string, options: any) => {
      switch (route) {
        case 'GET /repos/{owner}/{repo}/actions/workflows':
          return {
            data: {
              workflows: [
                {
                  id: 1,
                  path: PREPARE_PATCH_WORKFLOW_PATH,
                },
                {
                  id: 2,
                  path: PREPARE_NON_PATCH_WORKFLOW_PATH,
                },
              ],
            },
          };
        case 'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs':
          return {
            data: {
              workflow_runs: [
                {
                  id: options.workflow_id === 1 ? 100 : 200,
                  status: 'in_progress',
                },
                {
                  id: options.workflow_id === 1 ? 150 : 250,
                  status: 'completed',
                },
              ],
            },
          };
        case 'POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel':
          return undefined; // success
        default:
          throw new Error(`Unexpected route: ${route}`);
      }
    }) as any);
  });

  it('should fail early when no GH_TOKEN is set', async () => {
    delete process.env.GH_TOKEN;
    await expect(cancelPreparationWorkflows()).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: GH_TOKEN environment variable must be set, exiting.]`
    );
  });

  it('should cancel all running preparation workflows in GitHub', async () => {
    process.env.GH_TOKEN = 'MY_SECRET';

    await expect(cancelPreparationWorkflows()).resolves.toBeUndefined();

    expect(github.githubRestClient).toHaveBeenCalledTimes(5);
    expect(github.githubRestClient).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel',
      {
        owner: 'storybookjs',
        repo: 'storybook',
        run_id: 100,
      }
    );
    expect(github.githubRestClient).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel',
      {
        owner: 'storybookjs',
        repo: 'storybook',
        run_id: 200,
      }
    );
    expect(github.githubRestClient).not.toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel',
      {
        owner: 'storybookjs',
        repo: 'storybook',
        run_id: 150,
      }
    );
    expect(github.githubRestClient).not.toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel',
      {
        owner: 'storybookjs',
        repo: 'storybook',
        run_id: 250,
      }
    );
  });
});
