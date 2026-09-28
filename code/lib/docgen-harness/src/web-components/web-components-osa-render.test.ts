// @vitest-environment happy-dom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryContextForRender } from 'storybook/internal/types';

import { Channel, setChannel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import { registerService } from 'storybook/preview-api';

import { docgenServiceDef } from '../../../../core/src/shared/open-service/services/docgen/definition.ts';
import { clearRegistry } from '../../../../core/src/shared/open-service/service-registry.ts';
import { loadComponentDocgen } from '../../../../renderers/web-components/src/docgen-render/component-docgen.ts';
import { renderStorySource } from '../../../../renderers/web-components/src/docs/sourceDecorator.ts';
import { render } from '../../../../renderers/web-components/src/render.ts';
import type { WebComponentsRenderer } from '../../../../renderers/web-components/src/types.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { BASELINE_PATH } from './baseline-path.ts';
import type { Meta, Story } from './csf-types.ts';
import { entryForFixture, runProvider } from './osa-provider.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'web-components-osa-render.test.ts records the OSA render path against legacy custom-elements manifest baselines; update the recorder or baseline-path.ts'
  );
}

vi.mock('storybook/internal/node-logger', { spy: true });

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

beforeEach(() => {
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.debug).mockImplementation(() => {});
});

afterEach(() => {
  clearRegistry();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('web-components OSA render baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule as { default: Meta } & Record<
      string,
      Story
    >;
    const tagName = meta.component;
    const payload = await runProvider(
      testDir,
      entryForFixture(fixtureCase, testDir),
      join(testDir, 'custom-elements.json')
    );

    expect(payload?.argTypes).toBeDefined();
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    // happy-dom files start without an addons channel; registerService throws without one.
    setChannel(new Channel({ transport: { setHandler: vi.fn(), send: vi.fn() } }));
    registerService(docgenServiceDef, {
      commands: {
        extractDocgen: {
          handler: async (input, ctx) => {
            const payloadForInput = { ...payload!, id: input.id };
            ctx.self.setState((state) => {
              state.components[input.id] = payloadForInput;
            });
            return payloadForInput;
          },
        },
      },
    });

    const recordedSnippetFiles: string[] = [];

    for (const [exportName, story] of Object.entries(stories)) {
      if (story.render || meta.render) {
        continue;
      }

      const args = { ...meta.args, ...story.args };
      const context = {
        id: `${fixtureCase}--${exportName}`,
        componentId: fixtureCase,
        component: tagName,
        parameters: {},
        argTypes: {},
      } as StoryContextForRender<WebComponentsRenderer>;
      await loadComponentDocgen(context);
      const result = render(args, context);
      expect(result).toBeInstanceOf(Node);
      const node = result as Node;
      const snippet = renderStorySource(node);
      const host = document.createElement('div');
      document.body.appendChild(host);
      host.append(node);
      expect(host.firstElementChild, `${fixtureCase}/${exportName}`).not.toBeNull();

      const legacySnippetPath = join(testDir, `snippet-${exportName}.snapshot`);
      const legacy = readCommitted(legacySnippetPath);
      expect(legacy, `missing legacy ${legacySnippetPath}`).toBeDefined();
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'web-components',
        baseline: legacy!,
        candidate: snippet,
      });

      const osaSnippetPath = join(testDir, `osa-snippet-${exportName}.snapshot`);
      const committedOsa = readCommitted(osaSnippetPath);
      if (committedOsa !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'web-components',
          baseline: committedOsa,
          candidate: snippet,
        });
      }
      await expect(snippet).toMatchFileSnapshot(osaSnippetPath);
      recordedSnippetFiles.push(`osa-snippet-${exportName}.snapshot`);
    }

    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('osa-snippet-') && file.endsWith('.snapshot'))
      .sort();
    expect(snippetFilesOnDisk).toEqual(recordedSnippetFiles.sort());
  });
});
