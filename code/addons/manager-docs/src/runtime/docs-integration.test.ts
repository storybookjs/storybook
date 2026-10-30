import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Channel } from 'storybook/internal/channels';
import { describe, expect, it } from 'vitest';

import { Addon_TypesEnum } from '../../../../core/src/types/modules/addons.ts';
import { selectDocsCanvas } from '../../../../core/src/manager/components/preview/docs-canvas.ts';
import { MAIN_CANVAS_ID } from '../constants.ts';
import { storyFrameQuery } from '../preview-participant.ts';
import { mdxFileInProject } from '../server/read-mdx.ts';
import {
  mountDocsInstances,
  openDocsPage,
  releaseDocsFrames,
  writeDocsInstanceArgs,
} from './docs-page.ts';
import { createIframeHost } from './iframe-session.ts';
import {
  INSTANCE_CHANNEL_EVENT,
  bindInstanceParticipant,
  connectInstanceTransport,
} from './instance-transport.ts';
import { serveMdxSource } from './source-transport.ts';

const mdx = [
  "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
  "import * as ButtonStories from './Button.stories';",
  '',
  '# Buttons',
  '',
  '<SB.Story of={ButtonStories.Primary} />',
  '',
  '<SB.Story of={ButtonStories.Primary} />',
  '',
].join('\n');

const entries = [
  {
    type: 'docs',
    id: 'button--docs',
    importPath: 'src/Button.mdx',
    storiesImports: ['src/Button.stories.ts'],
  },
  {
    type: 'story',
    id: 'button--primary',
    importPath: 'src/Button.stories.ts',
    exportName: 'Primary',
    args: { label: 'Hello' },
  },
];

function readSource(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

describe('docs view slot', () => {
  it('selects the registered manager docs view for docs mode', () => {
    const renderer = { render: () => 'manager-docs' };
    const preview = readSource('../../../../core/src/manager/components/preview/Preview.tsx');
    const manager = readSource('../manager.tsx');

    expect(Addon_TypesEnum.experimental_MANAGER_DOCS).toBe('manager-docs');
    expect(selectDocsCanvas('docs', { addon: renderer })).toBe(renderer);
    expect(preview.indexOf('selectDocsCanvas(')).toBeGreaterThan(-1);
    expect(preview).toContain('Addon_TypesEnum.experimental_MANAGER_DOCS');
    expect(preview.indexOf('<DocsView')).toBeGreaterThan(preview.indexOf('selectDocsCanvas('));
    expect(preview.indexOf('<DocsView')).toBeLessThan(preview.indexOf('<FramesRenderer'));
    expect(preview).toContain('isLoading && !DocsView');
    expect(manager).toContain('addons.add');
    expect(manager).toContain('types.experimental_MANAGER_DOCS');
    expect(manager).toContain('ManagerDocsCanvas');
    expect(manager).not.toContain('setConfig');
    expect(readSource('../preview.ts')).toContain('bindInstanceParticipant');
    expect(readSource('../preview.ts')).toContain('getChannel()');
  });

  it('keeps the single preview iframe for story mode and for unregistered docs', () => {
    const preview = readSource('../../../../core/src/manager/components/preview/Preview.tsx');

    expect(selectDocsCanvas('docs', undefined)).toBeUndefined();
    expect(selectDocsCanvas('docs', {})).toBeUndefined();
    expect(selectDocsCanvas('docs', null)).toBeUndefined();
    expect(selectDocsCanvas('story', { addon: { render: () => 'manager-docs' } })).toBeUndefined();
    expect(preview).toContain('customCanvas ?');
    expect(preview).toContain('<FramesRenderer');
    expect(
      readSource('../../../../core/src/manager/components/preview/FramesRenderer.tsx')
    ).toContain('storybook-preview-iframe');
  });
});

describe('instance channel transport', () => {
  it('keeps args for two instances of one story separate from each other and the main canvas', async () => {
    const channel = new Channel({});
    serveMdxSource(channel, async () => mdx);
    const opened = await openDocsPage({
      file: 'src/Button.mdx',
      channel,
      entries,
      globals: { viewport: 'desktop' },
    });
    const [first, second] = opened.model.instances;
    expect(first?.storyId).toBe('button--primary');
    expect(second?.storyId).toBe('button--primary');
    expect(first?.instanceId).not.toBe(second?.instanceId);

    const transport = connectInstanceTransport(channel, opened.channelState);
    const seen = { first: 0, second: 0, main: 0 };
    const stopFirst = transport.listen(first!.instanceId, () => {
      seen.first += 1;
    });
    const stopSecond = transport.listen(second!.instanceId, () => {
      seen.second += 1;
    });
    const main = bindInstanceParticipant(channel, '?id=button--primary&viewMode=story', () => {
      seen.main += 1;
    });
    const previewSecond = bindInstanceParticipant(
      channel,
      `?${storyFrameQuery(second!.storyId, second!.instanceId)}`,
      () => {
        seen.second += 1;
      }
    );

    transport.updateArgs(first!.instanceId, first!.storyId, { label: 'Only first' });
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'args',
      storyId: 'button--primary',
      args: { label: 'shared' },
    });
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'args',
      instanceId: MAIN_CANVAS_ID,
      storyId: 'button--primary',
      args: { label: 'canvas' },
    });

    expect(transport.getState().instances[first!.instanceId]?.args).toEqual({
      label: 'Only first',
    });
    expect(transport.getState().instances[second!.instanceId]?.args).toEqual({ label: 'Hello' });
    expect(seen).toEqual({ first: 1, second: 0, main: 0 });
    expect(main.instanceId).toBeNull();
    expect(previewSecond.instanceId).toBe(second!.instanceId);

    const host = writeDocsInstanceArgs(
      mountDocsInstances(createIframeHost(), opened.model.instances),
      first!.instanceId,
      { label: 'Only first' }
    );
    expect(
      host.sessions.find((session) => session.frameId === first!.instanceId)?.occupant?.args
    ).toEqual({
      label: 'Only first',
    });
    expect(
      host.sessions.find((session) => session.frameId === second!.instanceId)?.occupant?.args
    ).toEqual({
      label: 'Hello',
    });
    expect(releaseDocsFrames(host).sessions.every((session) => session.occupant === null)).toBe(
      true
    );

    stopFirst();
    stopSecond();
    main.dispose();
    previewSecond.dispose();
    transport.disconnect();
  });
});

describe('indexed story paths', () => {
  it('resolves a story when the index importPath has the ./ prefix Storybook writes', async () => {
    const channel = new Channel({});
    serveMdxSource(channel, async () => mdx);
    const opened = await openDocsPage({
      file: './src/Button.mdx',
      channel,
      entries: [
        {
          type: 'story',
          id: 'button--primary',
          importPath: './src/Button.stories.tsx',
          exportName: 'Primary',
          args: { label: 'Hello' },
        },
      ],
      globals: {},
    });

    expect(opened.model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--primary',
    ]);
  });

  it('leaves story args with the iframe when the index omits them', async () => {
    const channel = new Channel({});
    serveMdxSource(channel, async () => mdx);
    const opened = await openDocsPage({
      file: './src/Button.mdx',
      channel,
      entries: [
        {
          type: 'story',
          id: 'button--primary',
          importPath: './src/Button.stories.tsx',
          exportName: 'Primary',
        },
      ],
      globals: {},
    });
    const host = mountDocsInstances(createIframeHost(), opened.model.instances);

    expect(opened.model.instances.every((instance) => instance.argsFromIndex)).toBe(false);
    expect(opened.model.instances[0]?.args).toEqual({});
    expect(host.sessions[0]?.occupant?.argsFromIndex).toBe(false);
  });
});

describe('MDX docs handoff', () => {
  it('delivers an MDX Story to the page model the manager view renders', async () => {
    const channel = new Channel({});
    const reads: string[] = [];
    serveMdxSource(channel, async (importPath) => {
      reads.push(importPath);
      return mdx;
    });

    const opened = await openDocsPage({
      file: 'src/Button.mdx',
      channel,
      entries,
      globals: { viewport: 'desktop' },
    });
    const canvas = readSource('../manager/ManagerDocsCanvas.tsx');

    expect(reads).toEqual(['src/Button.mdx']);
    expect(opened.model.blocks.map((block) => block.type)).toContain('story');
    expect(opened.model.instances).toHaveLength(2);
    expect(opened.model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--primary',
    ]);
    expect(opened.model.instances.map((instance) => instance.exportName)).toEqual([
      'Primary',
      'Primary',
    ]);
    expect(opened.model.instances[0]?.argsFromIndex).toBe(true);
    expect(opened.model.instances[0]?.args).toEqual({ label: 'Hello' });
    expect(opened.model.instances[0]?.args).not.toBe(opened.model.instances[1]?.args);
    expect(opened.model.instances[0]?.globals).toEqual({ viewport: 'desktop' });
    expect(canvas).toContain('loadDocsArticle');
    expect(canvas).toContain('<ManagerDocsView');
    expect(canvas).toContain('model={model}');
    expect(canvas).toContain('connectInstanceTransport');
  });

  it('refuses MDX paths that leave the project', () => {
    expect(mdxFileInProject('/proj', 'src/Button.mdx')).toBe('/proj/src/Button.mdx');
    expect(() => mdxFileInProject('/proj', '../secret.mdx')).toThrow(/outside the project/);
    expect(() => mdxFileInProject('/proj', 'src/Button.stories.ts')).toThrow(/not an MDX file/);
  });
});
