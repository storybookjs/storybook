import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { addLabels, removeLabels } from './labels.ts';

const target = { owner: 'storybookjs' as const, repo: 'storybook' as const, number: 1 };

describe('addLabels', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('is a no-op for an empty label list', async () => {
    let called = false;
    server.use(
      http.post('https://api.github.com/repos/storybookjs/storybook/issues/1/labels', () => {
        called = true;
        return HttpResponse.json([]);
      })
    );
    await addLabels(target, []);
    expect(called).toBe(false);
  });

  it('POSTs the label list', async () => {
    let received: unknown = null;
    server.use(
      http.post(
        'https://api.github.com/repos/storybookjs/storybook/issues/1/labels',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json([]);
        }
      )
    );
    await addLabels(target, ['mvc:success', 'agent-scan:human']);
    expect(received).toEqual({ labels: ['mvc:success', 'agent-scan:human'] });
  });
});

describe('removeLabels', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('is a no-op for an empty list', async () => {
    let calls = 0;
    server.use(
      http.delete(
        'https://api.github.com/repos/storybookjs/storybook/issues/1/labels/:name',
        () => {
          calls += 1;
          return HttpResponse.json([]);
        }
      )
    );
    await removeLabels(target, []);
    expect(calls).toBe(0);
  });

  it('DELETEs each label individually', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete(
        'https://api.github.com/repos/storybookjs/storybook/issues/1/labels/:name',
        ({ params }) => {
          deleted.push(String(params.name));
          return HttpResponse.json([]);
        }
      )
    );
    await removeLabels(target, ['mvc:skip', 'mvc:pending']);
    expect(deleted).toEqual(['mvc:skip', 'mvc:pending']);
  });

  it('swallows 404s (label was already absent)', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete(
        'https://api.github.com/repos/storybookjs/storybook/issues/1/labels/:name',
        ({ params }) => {
          if (params.name === 'missing') {
            return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
          }
          deleted.push(String(params.name));
          return HttpResponse.json([]);
        }
      )
    );
    await removeLabels(target, ['missing', 'real']);
    expect(deleted).toEqual(['real']);
  });
});
