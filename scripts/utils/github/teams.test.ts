import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { isMaintainer, listMaintainerLogins, listTeamMembers } from './teams.ts';

describe('isMaintainer', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('returns true if any team reports active membership', async () => {
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/core/memberships/alice', () =>
        HttpResponse.json({ state: 'active' })
      )
    );
    expect(await isMaintainer('alice')).toBe(true);
  });

  it('returns false if every team returns 404', async () => {
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/:team/memberships/:user', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );
    expect(await isMaintainer('outsider')).toBe(false);
  });

  it('propagates non-404 errors instead of downgrading to non-maintainer', async () => {
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/:team/memberships/:user', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    );
    await expect(isMaintainer('alice')).rejects.toThrow();
  });

  it('returns false for an empty login without hitting the API', async () => {
    expect(await isMaintainer('')).toBe(false);
  });
});

describe('listTeamMembers', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('paginates until a short page', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, login: `u${i + 1}` }));
    const page2 = [{ id: 101, login: 'u101' }];
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/core/members', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        return HttpResponse.json(page === '2' ? page2 : page1);
      })
    );
    const members = await listTeamMembers({ org: 'storybookjs', slug: 'core' });
    expect(members).toHaveLength(101);
    expect(members[100]).toBe('u101');
  });

  it('drops entries with no login field', async () => {
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/core/members', () =>
        HttpResponse.json([{ id: 1, login: 'alice' }, { id: 2 }])
      )
    );
    const members = await listTeamMembers({ org: 'storybookjs', slug: 'core' });
    expect(members).toEqual(['alice']);
  });
});

describe('listMaintainerLogins', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('returns the deduped union across all maintainer teams', async () => {
    server.use(
      http.get('https://api.github.com/orgs/storybookjs/teams/core/members', () =>
        HttpResponse.json([
          { id: 1, login: 'alice' },
          { id: 2, login: 'bob' },
        ])
      ),
      http.get('https://api.github.com/orgs/storybookjs/teams/developer-experience/members', () =>
        HttpResponse.json([
          { id: 3, login: 'bob' },
          { id: 4, login: 'carol' },
        ])
      ),
      http.get('https://api.github.com/orgs/storybookjs/teams/maintainers/members', () =>
        HttpResponse.json([])
      )
    );
    const logins = await listMaintainerLogins();
    expect([...logins].sort()).toEqual(['alice', 'bob', 'carol']);
  });
});
