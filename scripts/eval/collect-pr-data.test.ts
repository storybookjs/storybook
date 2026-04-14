import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileSyncMock = vi.fn();
const openDatabases: DatabaseSync[] = [];

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (openDatabases.length > 0) {
    openDatabases.pop()?.close();
  }
});

describe('listEvalPullRequests', () => {
  it('parses GitHub CLI JSON output on success', async () => {
    execFileSyncMock.mockReturnValueOnce(
      JSON.stringify([
        {
          number: 123,
          title: '[eval] mealdrop trial-123',
        },
      ])
    );

    const { listEvalPullRequests } = await import('./collect-pr-data.ts');

    await expect(listEvalPullRequests('storybook-tmp/mealdrop', 10)).resolves.toMatchObject([
      {
        number: 123,
        title: '[eval] mealdrop trial-123',
      },
    ]);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['pr', 'list', '--state', 'all']),
      expect.any(Object)
    );
  });

  it('passes through an explicit PR state override', async () => {
    execFileSyncMock.mockReturnValueOnce('[]');

    const { listEvalPullRequests } = await import('./collect-pr-data.ts');

    await expect(listEvalPullRequests('storybook-tmp/mealdrop', 10, 'open')).resolves.toEqual([]);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['pr', 'list', '--state', 'open']),
      expect.any(Object)
    );
  });

  it('throws a clear error when GitHub CLI cannot list PRs', async () => {
    execFileSyncMock.mockImplementationOnce(() => {
      throw Object.assign(new Error('Command failed: gh'), {
        status: 1,
        stderr: Buffer.from('authentication required\n'),
      });
    });

    const { listEvalPullRequests } = await import('./collect-pr-data.ts');

    await expect(listEvalPullRequests('storybook-tmp/mealdrop', 10)).rejects.toThrow(
      /Failed to list eval PRs for storybook-tmp\/mealdrop: .*stderr: authentication required/
    );
  });
});

describe('parseCliArgs', () => {
  it('defaults PR state to all', async () => {
    const { parseCliArgs } = await import('./collect-pr-data.ts');

    expect(parseCliArgs([])).toMatchObject({
      prState: 'all',
    });
  });

  it('parses --state open', async () => {
    const { parseCliArgs } = await import('./collect-pr-data.ts');

    expect(parseCliArgs(['--state', 'open'])).toMatchObject({
      prState: 'open',
    });
  });
});

describe('normalizeTrialData', () => {
  it('ingests v3 payloads while ignoring screenshot-era fields', async () => {
    const { normalizeTrialData } = await import('./collect-pr-data.ts');

    const normalized = normalizeTrialData({
      trialId: 'trial-123',
      data: createEvalDataPayload({
        schemaVersion: 3,
        screenshots: [
          {
            storyFilePath: 'src/Button.stories.tsx',
            exportName: 'Primary',
            imagePath: 'src/Button.stories.Primary.chromium.png',
          },
        ],
        artifacts: {
          buildOutput: {
            path: '.storybook/eval-results/build-output.txt',
          },
          typecheckOutput: {
            path: '.storybook/eval-results/typecheck-output.txt',
          },
          screenshotOutput: {
            path: '.storybook/eval-results/screenshot-output.txt',
          },
        },
      }),
    });

    expect(normalized).toMatchObject({
      dataSchemaVersion: 3,
      ghostBefore: {
        candidateCount: 4,
        total: 2,
        passed: 1,
      },
      ghostAfter: {
        candidateCount: 4,
        total: 2,
        passed: 2,
      },
      buildOutputPath: '.storybook/eval-results/build-output.txt',
      typecheckOutputPath: '.storybook/eval-results/typecheck-output.txt',
    });
    expect(normalized).not.toHaveProperty('screenshots');
    expect(normalized).not.toHaveProperty('screenshotOutputPath');
  });

  it('rejects v4 payloads that still include screenshots', async () => {
    const { normalizeTrialData } = await import('./collect-pr-data.ts');

    expect(() =>
      normalizeTrialData({
        trialId: 'trial-123',
        data: createEvalDataPayload({
          schemaVersion: 4,
          screenshots: [],
        }),
      })
    ).toThrow(
      /data\.json\.schemaVersion 4 must not include screenshot-era fields: data\.json\.screenshots/
    );
  });

  it('rejects v4 payloads that still include screenshot artifacts', async () => {
    const { normalizeTrialData } = await import('./collect-pr-data.ts');

    expect(() =>
      normalizeTrialData({
        trialId: 'trial-123',
        data: createEvalDataPayload({
          schemaVersion: 4,
          artifacts: {
            buildOutput: {
              path: '.storybook/eval-results/build-output.txt',
            },
            typecheckOutput: {
              path: '.storybook/eval-results/typecheck-output.txt',
            },
            screenshotOutput: {
              path: '.storybook/eval-results/screenshot-output.txt',
            },
          },
        }),
      })
    ).toThrow(
      /data\.json\.schemaVersion 4 must not include screenshot-era fields: data\.json\.artifacts\.screenshotOutput/
    );
  });
});

describe('ensureSchema', () => {
  it('creates the rebuilt schema without screenshot storage', async () => {
    const { ensureSchema } = await import('./collect-pr-data.ts');
    const db = createInMemoryDb();

    ensureSchema(db, '/tmp/eval-pr-data.sqlite');

    const trialColumns = db.prepare('PRAGMA table_info(trials)').all() as Array<{ name: string }>;
    const tableNames = db
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `)
      .all() as Array<{ name: string }>;

    expect(trialColumns.map((column) => column.name)).not.toContain('screenshot_output_path');
    expect(tableNames.map((table) => table.name)).not.toContain('trial_screenshots');
  });

  it('fails fast on a legacy screenshot-era cache DB', async () => {
    const { ensureSchema } = await import('./collect-pr-data.ts');
    const db = createInMemoryDb();

    db.exec(`
      CREATE TABLE trials (
        trial_id TEXT PRIMARY KEY,
        screenshot_output_path TEXT
      );
    `);

    expect(() => ensureSchema(db, '/tmp/eval-pr-data.sqlite')).toThrow(
      /Delete \.cache\/eval-pr-data\.sqlite .* rerun scripts\/eval\/collect-pr-data\.ts/
    );
  });
});

function createInMemoryDb() {
  const db = new DatabaseSync(':memory:');
  openDatabases.push(db);
  return db;
}

function createEvalDataPayload(overrides: Record<string, unknown>) {
  return {
    schemaVersion: 4,
    id: 'trial-123',
    timestamp: '2026-04-14T01:02:03.000Z',
    prompt: {
      name: 'setup',
      content: 'prompt body',
    },
    baselineCommit: 'deadbeef',
    variant: {
      agent: 'codex',
      model: 'gpt-5.4',
      effort: 'high',
    },
    environment: {
      nodeVersion: 'v22.22.1',
      evalBranch: 'trial/test-branch',
      evalCommit: 'abc123',
    },
    execution: {
      cost: 0.12,
      duration: 30,
      durationApi: 20,
      turns: 3,
      terminalResultSubtype: 'success',
    },
    grade: {
      buildSuccess: true,
      typeCheckErrors: 0,
      baselineGhostStories: {
        candidateCount: 4,
        total: 2,
        passed: 1,
      },
      ghostStories: {
        candidateCount: 4,
        total: 2,
        passed: 2,
      },
      baselinePreviewStories: {
        total: 4,
        passed: 1,
      },
      storyRender: {
        total: 4,
        passed: 3,
      },
      fileChanges: [] as Array<Record<string, unknown>>,
    },
    transcript: [] as unknown[],
    artifacts: {
      buildOutput: {
        path: '.storybook/eval-results/build-output.txt',
      },
      typecheckOutput: {
        path: '.storybook/eval-results/typecheck-output.txt',
      },
    },
    ...overrides,
  };
}
