import { fileURLToPath } from 'node:url';

import { createStorybook as createCoreStorybook } from '@storybook/core';
import { telemetry } from '@storybook/core/internal/telemetry';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTools } from './create-tools.ts';
import type { CreateToolsDeps } from './create-tools.ts';
import type { CreateToolsOptions } from './types.ts';

vi.mock('@storybook/core/internal/telemetry', { spy: true });

const FIXTURE = fileURLToPath(new URL('../__fixtures__/core-only', import.meta.url));

beforeEach(() => {
  vi.mocked(telemetry).mockResolvedValue(undefined);
  // Local mode loads in-process only from the target directory; workers cannot `chdir`.
  vi.spyOn(process, 'cwd').mockReturnValue(FIXTURE);
});

describe('core-only local tools', () => {
  it.each<{ name: string; options: CreateToolsOptions; deps: CreateToolsDeps }>([
    {
      name: 'with the core factory passed explicitly',
      options: { createStorybook: (input) => createCoreStorybook(input) },
      deps: {},
    },
    {
      name: 'with core defaults when storybook does not resolve',
      options: {},
      deps: { instanceFactory: { resolveInstanceEntry: () => undefined } },
    },
  ])('lists the fixture docs $name', async ({ options, deps }) => {
    const tools = await createTools({ cwd: FIXTURE, mode: 'local', ...options }, deps);
    try {
      const catalog = await tools.describe();
      const docs = await tools.call('docs.list');

      expect({
        host: tools.host,
        toolsets: catalog.toolsets.map((toolset) => toolset.id),
        ok: docs.ok,
        markdown: docs.markdown,
      }).toMatchInlineSnapshot(`
        {
          "host": "in-process",
          "markdown": "# Components

        - Button (button)",
          "ok": true,
          "toolsets": [
            "docs",
            "stories",
          ],
        }
      `);
    } finally {
      await tools.close();
    }
  });

  it('reports review as an unknown toolset, since review ships with storybook', async () => {
    const tools = await createTools(
      { cwd: FIXTURE, mode: 'local' },
      { instanceFactory: { resolveInstanceEntry: () => undefined } }
    );
    try {
      await expect(tools.call('review.create')).rejects.toMatchObject({
        data: { reason: 'unknown-toolset' },
      });
    } finally {
      await tools.close();
    }
  });

  it('runs change detection without the storybook common plugin', async () => {
    const tools = await createTools(
      { cwd: FIXTURE, mode: 'local' },
      { instanceFactory: { resolveInstanceEntry: () => undefined } }
    );
    try {
      await expect(tools.call('stories.changed')).resolves.toMatchObject({ ok: true });
    } finally {
      await tools.close();
    }
  });
});
