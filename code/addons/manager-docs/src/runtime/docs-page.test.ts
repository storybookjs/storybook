import { Channel } from 'storybook/internal/channels';
import { describe, expect, it } from 'vitest';

import { createChannelState } from './channel-router.ts';
import {
  acceptMdxSourceChange,
  buildDocsModel,
  mountDocsInstances,
  refreshDocsPage,
  syncDocsPool,
  unmountDocsInstances,
  withInstanceArgs,
  type IndexedEntry,
  type LiveDocsPage,
} from './docs-page.ts';
import { createIframeHost } from './iframe-session.ts';
import { INSTANCE_CHANNEL_EVENT, connectInstanceTransport } from './instance-transport.ts';

const file = 'src/Button.mdx';
const header =
  "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';\nimport * as ButtonStories from './Button.stories';\n\n";
const shown = `${header}Intro.\n\n<SB.Story of={ButtonStories.Primary} height={640} />\n`;

const primary: IndexedEntry = {
  type: 'story',
  id: 'button--primary',
  importPath: './src/Button.stories.tsx',
  exportName: 'Primary',
  args: { label: 'Hello' },
};
const secondary: IndexedEntry = { ...primary, id: 'button--secondary', exportName: 'Secondary' };

const syntaxError = {
  file,
  line: 3,
  column: 1,
  construct: 'jsx',
  message: 'Unclosed tag.',
};

function builder(entries: IndexedEntry[]) {
  return (source: string) => buildDocsModel({ file, source, entries, globals: {} });
}

function liveAt(source: string, entries = [primary]): LiveDocsPage {
  const model = withInstanceArgs(builder(entries)(source), 'button--primary#1', {
    label: 'Edited',
  });
  return { model, source, latest: source, revision: 0, error: null };
}

describe('acceptMdxSourceChange', () => {
  it('applies a prose edit to the matched instance without adding or removing frames', () => {
    const edited = shown.replace('Intro.', 'Intro.\n\nA second paragraph.');

    const update = acceptMdxSourceChange(
      liveAt(shown),
      { importPath: file, revision: 1, source: edited },
      builder([primary])
    );

    expect(update.added).toEqual([]);
    expect(update.removed).toEqual([]);
    expect(update.live.revision).toBe(1);
    expect(update.live.source).toBe(edited);
    expect(update.live.model.blocks.filter((block) => block.type === 'paragraph')).toHaveLength(2);
    expect(update.live.model.instances).toEqual([
      expect.objectContaining({ instanceId: 'button--primary#1', args: { label: 'Edited' } }),
    ]);
  });

  it('keeps the last good model and records the error for a parse-failure payload', () => {
    const live = liveAt(shown);

    const update = acceptMdxSourceChange(
      live,
      { importPath: file, revision: 1, error: syntaxError },
      builder([primary])
    );

    expect(update).toEqual({
      live: { ...live, latest: null, revision: 1, error: syntaxError },
      added: [],
      removed: [],
    });
    expect(update.live.model).toBe(live.model);
  });

  it('clears the error and reconciles on the next good revision', () => {
    const broken = acceptMdxSourceChange(
      liveAt(shown),
      { importPath: file, revision: 1, error: syntaxError },
      builder([primary])
    ).live;
    const fixed = `${shown}\n<SB.Story of={ButtonStories.Secondary} />\n`;

    const update = acceptMdxSourceChange(
      broken,
      { importPath: file, revision: 2, source: fixed },
      builder([primary, secondary])
    );

    expect(update.live.error).toBeNull();
    expect(update.live.source).toBe(fixed);
    expect(update.added.map((instance) => instance.instanceId)).toEqual(['button--secondary#1']);
    expect(update.live.model.instances[0]?.args).toEqual({ label: 'Edited' });
  });

  it('keeps the last good model when the new source names a story the index lacks', () => {
    const live = liveAt(shown);

    const update = acceptMdxSourceChange(
      live,
      {
        importPath: file,
        revision: 1,
        source: `${shown}\n<SB.Story of={ButtonStories.Secondary} />\n`,
      },
      builder([primary])
    );

    expect(update.live.model).toBe(live.model);
    expect(update.live.source).toBe(shown);
    expect(update.live.error).toMatchObject({ file, line: 8, construct: 'unresolved-story' });
  });

  it('drops a revision at or below the last applied one', () => {
    const live = { ...liveAt(shown), revision: 3 };

    for (const revision of [2, 3]) {
      expect(
        acceptMdxSourceChange(
          live,
          { importPath: file, revision, source: `${header}# Old\n` },
          builder([primary])
        )
      ).toEqual({ live, added: [], removed: [] });
    }
  });
});

describe('refreshDocsPage', () => {
  it('keeps a pushed syntax error while rebuilding the last good source', () => {
    const broken = acceptMdxSourceChange(
      liveAt(shown),
      { importPath: file, revision: 1, error: syntaxError },
      builder([primary])
    ).live;

    const update = refreshDocsPage(broken, builder([primary]));

    expect(update.live.error).toEqual(syntaxError);
    expect(update.live.model.instances[0]?.args).toEqual({ label: 'Edited' });
  });

  it('retries the newest source once the index knows the story it names', () => {
    const withSecondary = `${shown}\n<SB.Story of={ButtonStories.Secondary} />\n`;
    const unresolved = acceptMdxSourceChange(
      liveAt(shown),
      { importPath: file, revision: 1, source: withSecondary },
      builder([primary])
    ).live;

    const update = refreshDocsPage(unresolved, builder([primary, secondary]));

    expect(update.live.error).toBeNull();
    expect(update.live.source).toBe(withSecondary);
    expect(update.added.map((instance) => instance.instanceId)).toEqual(['button--secondary#1']);
  });
});

describe('frames for reconciled instances', () => {
  it('unmounts a removed instance so the same id can mount and route again', () => {
    const [instance] = builder([primary])(shown).instances;
    const channel = new Channel({});
    const transport = connectInstanceTransport(channel, createChannelState());
    const heights: number[] = [];
    transport.register(instance!.instanceId, instance!.storyId, instance!.args, instance!.globals);
    transport.listen(instance!.instanceId, (event) => heights.push(event.height ?? -1));
    const mounted = mountDocsInstances(createIframeHost(), [instance!]);

    const removed = unmountDocsInstances(mounted, [instance!.instanceId]);
    transport.unregister(instance!.instanceId);
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'height',
      instanceId: instance!.instanceId,
      height: 10,
    });

    expect(removed.sessions).toEqual([]);
    expect(heights).toEqual([]);

    const again = mountDocsInstances(removed, [instance!]);
    transport.register(instance!.instanceId, instance!.storyId, instance!.args, instance!.globals);
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'height',
      instanceId: instance!.instanceId,
      height: 20,
    });

    expect(again.sessions.map((session) => session.frameId)).toEqual([instance!.instanceId]);
    expect(heights).toEqual([20]);
    transport.disconnect();
  });

  it('reuses a pooled frame for the next visible instance without leaking occupant args', () => {
    const first = builder([primary])(shown).instances[0]!;
    const second = {
      ...first,
      instanceId: 'button--primary#2',
      args: { label: 'Next' },
      documentOrder: 1,
    };
    const seated = syncDocsPool(createIframeHost(), [first.instanceId], [first, second]);
    const reused = syncDocsPool(seated.host, [second.instanceId], [first, second]);

    expect(seated.seats).toEqual([
      { frameId: 'frame-1', instanceId: first.instanceId, reused: false },
    ]);
    expect(reused.seats).toEqual([
      { frameId: 'frame-1', instanceId: second.instanceId, reused: true },
    ]);
    expect(reused.host.sessions).toHaveLength(1);
    expect(reused.host.sessions[0]?.occupant).toMatchObject({
      instanceId: second.instanceId,
      args: { label: 'Next' },
      play: 'idle',
      generation: 2,
    });
  });
});
