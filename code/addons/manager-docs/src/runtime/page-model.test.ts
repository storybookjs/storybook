import { describe, expect, it } from 'vitest';

import { ManagerDocsParseError } from '../errors.ts';
import { parseManagerDocs } from '../parser/parse-mdx.ts';
import { displayedFrameHeight, ratioFrameHeight } from './frame-height.ts';
import {
  createArticleModel,
  displayedStoryPanel,
  showsStoryToolbar,
  reconcileArticleModel,
} from './page-model.ts';

const source = `
import * as SB from '@storybook/experimental-addon-manager-docs/mdx';
import * as ButtonStories from './Button.stories';

<SB.Story of={ButtonStories.Primary} />

<SB.Story of={ButtonStories.Primary} focus />
`;

describe('createArticleModel', () => {
  it('gives each reference its own instance, args, and globals', () => {
    const saved = { label: 'Save' };
    const globals = { theme: 'light' };
    const model = createArticleModel(
      parseManagerDocs(source, 'page.mdx'),
      () => ({ storyId: 'button--primary', args: saved }),
      globals,
      'page.mdx'
    );

    expect(model.instances.map((instance) => instance.documentOrder)).toEqual([0, 1]);
    expect(model.instances.map((instance) => instance.instanceId)).toEqual([
      'button--primary#1',
      'button--primary#2',
    ]);
    expect(model.instances.map((instance) => instance.focus)).toEqual([false, true]);
    expect(model.instances[0]?.args).not.toBe(model.instances[1]?.args);
    expect(model.instances[0]?.globals).not.toBe(model.instances[1]?.globals);

    saved.label = 'Changed';
    globals.theme = 'dark';
    model.instances[0]!.args.label = 'One';
    model.instances[0]!.globals.theme = 'dim';

    expect(model.instances[1]?.args).toEqual({ label: 'Save' });
    expect(model.instances[1]?.globals).toEqual({ theme: 'light' });
  });

  it('reports an unresolved story at the block', () => {
    expect(() =>
      createArticleModel(parseManagerDocs(source, 'page.mdx'), () => undefined, {}, 'page.mdx')
    ).toThrow(ManagerDocsParseError);

    try {
      createArticleModel(parseManagerDocs(source, 'page.mdx'), () => undefined, {}, 'page.mdx');
    } catch (error) {
      expect(error).toMatchObject({
        construct: 'unresolved-story',
        file: 'page.mdx',
        line: 5,
        column: 1,
      });
    }
  });

  it('gives stories nested in a blockquote and a list their own args', () => {
    const nested = [
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
      "import * as ButtonStories from './Button.stories';",
      '',
      '> <SB.Story of={ButtonStories.Primary} />',
      '',
      '- <SB.Story of={ButtonStories.Primary} />',
      '',
    ].join('\n');
    const saved = { label: 'Save', style: { color: 'red' } };
    const model = createArticleModel(
      parseManagerDocs(nested, 'page.mdx'),
      () => ({ storyId: 'button--primary', args: saved }),
      { theme: 'light' },
      'page.mdx'
    );

    expect(model.instances.map((instance) => instance.instanceId)).toEqual([
      'button--primary#1',
      'button--primary#2',
    ]);
    const firstStyle = model.instances[0]?.args.style as { color: string };
    firstStyle.color = 'blue';
    saved.style.color = 'green';

    expect(model.instances[1]?.args).toEqual({ label: 'Save', style: { color: 'red' } });
    expect(model.instances[0]?.globals).not.toBe(model.instances[1]?.globals);
  });

  it('carries an explicit story height from the parser through the model to the iframe', () => {
    const source = [
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
      "import * as ButtonStories from './Button.stories';",
      '',
      '<SB.Story of={ButtonStories.Primary} height="100vh" />',
      '',
      '<SB.Story of={ButtonStories.Primary} />',
      '',
    ].join('\n');
    const model = createArticleModel(
      parseManagerDocs(source, 'page.mdx'),
      () => ({ storyId: 'button--primary' }),
      {},
      'page.mdx'
    );

    expect(model.blocks[0]).toMatchObject({ type: 'story', height: '100vh' });
    expect(model.blocks[1]).toMatchObject({ type: 'story' });
    expect(model.blocks[1]).not.toHaveProperty('height');
    expect(model.instances.map((instance) => instance.height)).toEqual(['100vh', undefined]);
    expect(displayedFrameHeight(model.instances[0]?.height, 40, 720)).toBe(720);
    expect(displayedFrameHeight(model.instances[1]?.height, 40, 720)).toBe(200);
    expect(model.instances[0]).not.toHaveProperty('ratio');
    expect(model.instances[1]).not.toHaveProperty('ratio');
  });

  it('carries auto, pixel, and ratio sizing on separate stories', () => {
    const source = [
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
      "import * as ButtonStories from './Button.stories';",
      '',
      '<SB.Story of={ButtonStories.Primary} />',
      '',
      '<SB.Story of={ButtonStories.Primary} height="auto" />',
      '',
      '<SB.Story of={ButtonStories.Primary} height={320} />',
      '',
      '<SB.Story of={ButtonStories.Secondary} ratio="16/9" />',
      '',
    ].join('\n');
    const model = createArticleModel(
      parseManagerDocs(source, 'page.mdx'),
      (reference) => ({ storyId: `button--${reference.exportName.toLowerCase()}` }),
      {},
      'page.mdx'
    );

    expect(model.instances.map((instance) => instance.height)).toEqual([
      undefined,
      undefined,
      320,
      undefined,
    ]);
    expect(model.instances.map((instance) => instance.ratio)).toEqual([
      undefined,
      undefined,
      undefined,
      16 / 9,
    ]);
    expect(model.instances[0]).not.toHaveProperty('height');
    expect(model.instances[1]).not.toHaveProperty('height');
    expect(model.instances[2]).not.toHaveProperty('ratio');
    expect(model.instances[3]).not.toHaveProperty('height');
    expect(displayedFrameHeight(model.instances[2]?.height, 900, 1040)).toBe(320);
    expect(ratioFrameHeight(960, model.instances[3]?.ratio ?? 0)).toBe(540);
  });

  it('shows the real toolbar when toolbar is omitted and hides it for an empty list', () => {
    const source = [
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
      "import * as ButtonStories from './Button.stories';",
      '',
      '<SB.Story of={ButtonStories.Primary} />',
      '',
      '<SB.Story of={ButtonStories.Primary} toolbar={[]} />',
      '',
      '<SB.Story of={ButtonStories.Secondary} toolbar={true} />',
      '',
      '<SB.Story of={ButtonStories.Secondary} toolbar={false} />',
      '',
    ].join('\n');
    const model = createArticleModel(
      parseManagerDocs(source, 'page.mdx'),
      (reference) => ({ storyId: `button--${reference.exportName.toLowerCase()}` }),
      {},
      'page.mdx'
    );

    expect(model.instances.map((instance) => instance.toolbar)).toEqual([
      undefined,
      false,
      true,
      false,
    ]);
    expect(model.instances[0]).not.toHaveProperty('toolbar');
    expect(model.instances.map((instance) => showsStoryToolbar(instance.toolbar))).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--primary',
      'button--secondary',
      'button--secondary',
    ]);
  });

  it('shows Actions and Interactions for an omitted panel and panel={true}, and no panel for false or []', () => {
    const source = [
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
      "import * as ButtonStories from './Button.stories';",
      '',
      '<SB.Story of={ButtonStories.Primary} />',
      '',
      '<SB.Story of={ButtonStories.Primary} panel={true} />',
      '',
      '<SB.Story of={ButtonStories.Primary} panel={false} />',
      '',
      '<SB.Story of={ButtonStories.Primary} panel={[]} />',
      '',
      "<SB.Story of={ButtonStories.Primary} panel={['interactions', 'actions']} />",
      '',
    ].join('\n');
    const model = createArticleModel(
      parseManagerDocs(source, 'page.mdx'),
      () => ({ storyId: 'button--primary' }),
      {},
      'page.mdx'
    );

    expect(model.instances.map((instance) => instance.panel)).toEqual([
      undefined,
      true,
      false,
      [],
      ['interactions', 'actions'],
    ]);
    expect(model.instances[0]).not.toHaveProperty('panel');
    expect(model.blocks.map((block) => (block.type === 'story' ? block.panel : undefined))).toEqual(
      [undefined, true, false, [], ['interactions', 'actions']]
    );
    expect(model.instances.map((instance) => displayedStoryPanel(instance.panel))).toEqual([
      ['actions', 'interactions'],
      ['actions', 'interactions'],
      [],
      [],
      ['interactions', 'actions'],
    ]);
  });

  it('keeps instance ids when a prose edit shifts story lines', () => {
    const before = [
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
      "import * as ButtonStories from './Button.stories';",
      '',
      '<SB.Story of={ButtonStories.Primary} />',
      '',
      '<SB.Story of={ButtonStories.Secondary} />',
      '',
      '<SB.Story of={ButtonStories.Primary} />',
      '',
    ].join('\n');
    const after = before.replace(
      '<SB.Story of={ButtonStories.Primary} />',
      '# Intro\n\nA new paragraph\nover two lines.\n\n<SB.Story of={ButtonStories.Primary} />'
    );
    const ids = (text: string) =>
      createArticleModel(parseManagerDocs(text, 'page.mdx'), resolveByExport, {}, 'page.mdx')
        .instances;

    expect(ids(after).map((instance) => instance.position.line)).not.toEqual(
      ids(before).map((instance) => instance.position.line)
    );
    expect(ids(after).map((instance) => instance.instanceId)).toEqual([
      'button--primary#1',
      'button--secondary#1',
      'button--primary#2',
    ]);
    expect(ids(before).map((instance) => instance.instanceId)).toEqual(
      ids(after).map((instance) => instance.instanceId)
    );
  });
});

function resolveByExport(reference: { exportName: string }) {
  return {
    storyId: `button--${reference.exportName.toLowerCase()}`,
    args: { label: reference.exportName },
  };
}

function modelOf(lines: string[]) {
  return createArticleModel(
    parseManagerDocs(
      [
        "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
        "import * as ButtonStories from './Button.stories';",
        '',
        ...lines,
      ].join('\n'),
      'page.mdx'
    ),
    resolveByExport,
    { theme: 'light' },
    'page.mdx'
  );
}

describe('reconcileArticleModel', () => {
  it('reports every instance as added when nothing is shown yet', () => {
    const next = modelOf(['<SB.Story of={ButtonStories.Primary} />']);

    expect(reconcileArticleModel(null, next)).toEqual({
      model: next,
      added: next.instances,
      removed: [],
    });
  });

  it('keeps args and globals of matched instances and adopts the new chrome and sizing', () => {
    const shown = modelOf(['<SB.Story of={ButtonStories.Primary} />', '', 'Old prose.']);
    const live = {
      ...shown,
      instances: shown.instances.map((instance) => ({
        ...instance,
        args: { label: 'Edited' },
        argsFromIndex: true,
        globals: { theme: 'light', viewport: 'mobile' },
      })),
    };
    const next = modelOf([
      'New prose.',
      '',
      "<SB.Story of={ButtonStories.Primary} focus height={640} toolbar={[]} panel={['interactions']} />",
    ]);

    const result = reconcileArticleModel(live, next);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.model.blocks).toBe(next.blocks);
    expect(result.model.instances).toEqual([
      expect.objectContaining({
        instanceId: 'button--primary#1',
        args: { label: 'Edited' },
        argsFromIndex: true,
        globals: { theme: 'light', viewport: 'mobile' },
        focus: true,
        height: 640,
        toolbar: false,
        panel: ['interactions'],
        position: next.instances[0]!.position,
      }),
    ]);
  });

  it('drops sizing and chrome the new block no longer sets', () => {
    const live = modelOf(['<SB.Story of={ButtonStories.Primary} ratio="16/9" toolbar={[]} />']);
    const next = modelOf(['<SB.Story of={ButtonStories.Primary} />']);

    const [instance] = reconcileArticleModel(live, next).model.instances;

    expect(instance).not.toHaveProperty('ratio');
    expect(instance).not.toHaveProperty('toolbar');
  });

  it('flags new occurrences for mount and deleted references for unmount', () => {
    const live = modelOf([
      '<SB.Story of={ButtonStories.Primary} />',
      '',
      '<SB.Story of={ButtonStories.Secondary} />',
    ]);
    const next = modelOf([
      '<SB.Story of={ButtonStories.Primary} />',
      '',
      '<SB.Story of={ButtonStories.Primary} />',
    ]);

    const result = reconcileArticleModel(live, next);

    expect(result.added.map((instance) => instance.instanceId)).toEqual(['button--primary#2']);
    expect(result.removed.map((instance) => instance.instanceId)).toEqual(['button--secondary#1']);
    expect(result.model.instances.map((instance) => instance.instanceId)).toEqual([
      'button--primary#1',
      'button--primary#2',
    ]);
  });
});
