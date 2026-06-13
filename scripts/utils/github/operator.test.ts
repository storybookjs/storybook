import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { resolveOperator } from './operator.ts';

const coords = { owner: 'storybookjs' as const, repo: 'storybook' as const, number: 35121 };

describe('resolveOperator', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('returns null when there are no copilot_work_started events', async () => {
    server.use(
      http.get(
        'https://api.github.com/repos/storybookjs/storybook/issues/35121/timeline',
        () => HttpResponse.json([{ event: 'labeled', created_at: '2026-06-10T00:00:00Z' }])
      )
    );
    expect(await resolveOperator(coords)).toBeNull();
  });

  it('returns the earliest copilot_work_started actor', async () => {
    server.use(
      http.get(
        'https://api.github.com/repos/storybookjs/storybook/issues/35121/timeline',
        () =>
          HttpResponse.json([
            {
              event: 'copilot_work_started',
              actor: { login: 'Sidnioulz' },
              created_at: '2026-06-10T08:25:24Z',
            },
            { event: 'labeled', created_at: '2026-06-10T07:00:00Z' },
            {
              event: 'copilot_work_started',
              actor: { login: 'Sidnioulz' },
              created_at: '2026-06-10T06:29:26Z',
            },
          ])
      )
    );
    expect(await resolveOperator(coords)).toBe('Sidnioulz');
  });

  it('ignores copilot_work_started events without an actor login', async () => {
    server.use(
      http.get(
        'https://api.github.com/repos/storybookjs/storybook/issues/35121/timeline',
        () =>
          HttpResponse.json([
            {
              event: 'copilot_work_started',
              actor: null,
              created_at: '2026-06-10T06:29:26Z',
            },
          ])
      )
    );
    expect(await resolveOperator(coords)).toBeNull();
  });
});
