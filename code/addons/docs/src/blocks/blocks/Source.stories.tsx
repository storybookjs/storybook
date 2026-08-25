import type { ProfilerOnRenderCallback } from 'react';
import React, { Profiler, memo, useCallback, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { SourceType } from 'storybook/internal/docs-tools';
import type { ModuleExport, StoryContext, StoryDocsPayload } from 'storybook/internal/types';
import { registerService } from 'storybook/preview-api';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, waitFor, within } from 'storybook/test';
import { dedent } from 'ts-dedent';
import invariant from 'tiny-invariant';

import * as ParametersStories from '../examples/SourceParameters.stories';
import { Source } from './Source';
import { SourceContext, argsHash } from './SourceContainer';
import type { DocsContextProps } from './DocsContext.ts';
import { storyDocsServiceDef } from '../../../../../core/src/shared/open-service/services/story-docs/definition.ts';
import { unregisterService } from '../../../../../core/src/shared/open-service/service-registry.ts';

type StoryDocsMockData = {
  snippet?: string;
  import?: string;
};

function createStoryDocsPayload(
  docsContext: DocsContextProps,
  of: ModuleExport,
  data: StoryDocsMockData
): StoryDocsPayload {
  const { story } = docsContext.resolveOf(of, ['story']);
  const componentId = story.id.split('--')[0]!;

  return {
    id: componentId,
    name: componentId,
    path: './example.stories.tsx',
    ...(data.import ? { import: data.import } : {}),
    stories: {
      [story.id]: {
        id: story.id,
        name: story.name,
        ...(data.snippet ? { snippet: data.snippet } : {}),
      },
    },
  };
}

function storyDocsServiceStoryBeforeEach(of: ModuleExport, data: StoryDocsMockData) {
  return async (context: StoryContext) => {
    const docsContext = context.loaded?.docsContext as DocsContextProps | undefined;
    invariant(docsContext, 'docsContext is required to mock story-docs for docs block stories');

    // The docs blocks only consume the story-docs service when this feature is enabled, but it is
    // disabled by default in production builds (e.g. Chromatic). Enable it here so the service-backed
    // story renders the mocked data instead of falling back to the non-service path.
    const previousFeatures = globalThis.FEATURES;
    globalThis.FEATURES = { ...previousFeatures, experimentalDocgenServer: true };

    const payload = createStoryDocsPayload(docsContext, of, data);
    unregisterService('core/story-docs');
    const service = registerService(storyDocsServiceDef, {
      commands: {
        extractStoryDocs: {
          handler: (input, ctx) => {
            ctx.self.setState((state) => {
              state.components[input.id] = payload;
            });
            return payload;
          },
        },
        extractAllStoryDocs: {
          handler: (_input, ctx) => {
            ctx.self.setState((state) => {
              state.components[payload.id] = payload;
            });
          },
        },
      },
    });
    await service.commands.extractStoryDocs({ id: payload.id });

    return () => {
      unregisterService('core/story-docs');
      globalThis.FEATURES = previousFeatures;
    };
  };
}

const SERVICE_IMPORT = "import { EmptyExample } from './EmptyExample';";
const SERVICE_SNIPPET = '<EmptyExample something="from-service" />';

const meta: Meta<typeof Source> = {
  component: Source,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: ['../examples/SourceParameters.stories'],
    snippets: {
      'storybook-blocks-examples-stories-for-the-source-block--no-parameters': {
        [argsHash({})]: {
          code: `const emitted = 'source';`,
        },
      },
      'storybook-blocks-examples-stories-for-the-source-block--transform': {
        [argsHash({})]: {
          code: `const emitted = 'source';`,
        },
      },
      'storybook-blocks-examples-stories-for-the-source-block--type-dynamic': {
        [argsHash({})]: {
          code: `const emitted = 'source';`,
        },
      },
    },
    docsStyles: true,
  },
  decorators: [
    (Story, { parameters: { snippets = {} } }) => (
      <SourceContext.Provider value={{ sources: snippets }}>
        <Story />
      </SourceContext.Provider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const code = `query HeroNameAndFriends($episode: Episode) {
          hero(episode: $episode) {
            name
            friends {
              name
            }
          }
        }
`;

const BENCHMARK_SNIPPET = `const emitted = 'source';`;
const BENCHMARK_CODE = `<some>html</some>`;

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => {
        globalThis.requestAnimationFrame(() => resolve());
      });
      return;
    }

    globalThis.setTimeout(resolve, 0);
  });

const BenchmarkControls = ({
  countRef,
  resultRef,
  onUpdate,
  onRunBenchmark,
}: {
  countRef: React.RefObject<HTMLOutputElement>;
  resultRef: React.RefObject<HTMLSpanElement>;
  onUpdate: () => void;
  onRunBenchmark: () => void;
}) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
    <Button ariaLabel={false} data-testid="update-snippets" onClick={onUpdate} variant="outline">
      Update snippets
    </Button>
    <Button
      ariaLabel={false}
      data-testid="run-benchmark"
      onClick={onRunBenchmark}
      variant="outline"
    >
      Run 5 updates
    </Button>
    <span>
      Source renders: <output data-testid="render-count" ref={countRef} />
    </span>
    <span data-testid="benchmark-result" ref={resultRef}>
      Idle
    </span>
  </div>
);

const StaticSourceList = memo(function StaticSourceList({
  blocks,
  onRender,
}: {
  blocks: number;
  onRender: ProfilerOnRenderCallback;
}) {
  return (
    <>
      {Array.from({ length: blocks }, (_, index) => (
        <Profiler id={`static-source-${index}`} key={index} onRender={onRender}>
          <Source code={BENCHMARK_CODE} language="html" />
        </Profiler>
      ))}
    </>
  );
});

const renderCountHash = argsHash({});

const BenchmarkHarness = ({ blocks }: { blocks: number }) => {
  const [iteration, setIteration] = useState(0);
  const countRef = useRef<HTMLOutputElement>(null);
  const resultRef = useRef<HTMLSpanElement>(null);
  const renderCount = useRef(0);

  const updateCount = useCallback((value: number) => {
    renderCount.current = value;
    if (countRef.current) {
      countRef.current.value = `${value}`;
      countRef.current.textContent = `${value}`;
    }
  }, []);

  const updateResult = useCallback((value: string) => {
    if (resultRef.current) {
      resultRef.current.textContent = value;
    }
  }, []);

  const handleRender = useCallback<ProfilerOnRenderCallback>(() => {
    updateCount(renderCount.current + 1);
  }, [updateCount]);

  const sources = {
    [`benchmark-static-${iteration}`]: {
      [renderCountHash]: {
        code: `${BENCHMARK_SNIPPET} // ${iteration}`,
      },
    },
  };

  const updateSnippets = useCallback(() => {
    updateResult('Idle');
    setIteration((value) => value + 1);
  }, [updateResult]);

  const runBenchmark = useCallback(async () => {
    const runSteps = async (withUpdates: boolean) => {
      for (let step = 0; step < 5; step += 1) {
        if (withUpdates) {
          setIteration((value) => value + 1);
        }
        await waitForNextPaint();
      }
    };

    const measureRenders = async (work: () => Promise<void>) => {
      const startRenders = renderCount.current;
      const start = performance.now();
      await work();
      return {
        elapsed: performance.now() - start,
        renders: renderCount.current - startRenders,
      };
    };

    // Subtract background render noise (e.g. interactions rerun bookkeeping) to keep
    // the benchmark stable across fresh loads and "Rerun" runs.
    const baseline = await measureRenders(async () => runSteps(false));
    const measured = await measureRenders(async () => runSteps(true));
    const additionalRenders = Math.max(0, measured.renders - baseline.renders);

    updateResult(`${additionalRenders} extra renders in ${measured.elapsed.toFixed(1)}ms`);
  }, [updateResult]);

  return (
    <>
      <BenchmarkControls
        countRef={countRef}
        resultRef={resultRef}
        onUpdate={updateSnippets}
        onRunBenchmark={() => void runBenchmark()}
      />
      <SourceContext.Provider value={{ sources }}>
        <StaticSourceList blocks={blocks} onRender={handleRender} />
      </SourceContext.Provider>
    </>
  );
};

export const DefaultAttached = {};

export const Of: Story = {
  args: {
    of: ParametersStories.NoParameters,
  },
};

export const OfStorySnippetFromStoryDocsService: Story = {
  args: {
    of: ParametersStories.NoParameters,
  },
  beforeEach: storyDocsServiceStoryBeforeEach(ParametersStories.NoParameters, {
    import: SERVICE_IMPORT,
    snippet: SERVICE_SNIPPET,
  }),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const text = canvasElement.textContent ?? '';
      expect(text).toContain('EmptyExample');
      expect(text).toContain('something=');
      expect(text).not.toContain("const emitted = 'source';");
    });
  },
};

export const OfUndefined: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    of: ParametersStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['!test'],
};

export const OfTypeProp: Story = {
  args: {
    of: ParametersStories.NoParameters,
    type: SourceType.CODE,
  },
};

export const OfTypeParameter: Story = {
  args: {
    of: ParametersStories.TypeCode,
  },
};

export const OfTransformProp: Story = {
  args: {
    of: ParametersStories.NoParameters,
    transform: (src, storyContext) => dedent`// this comment has been added via the transform prop!
    // this is the story id: ${storyContext.id}
    // these are the current args: ${JSON.stringify(storyContext.args)}
    ${src}`,
  },
};

export const OfTransformParameter: Story = {
  args: {
    of: ParametersStories.Transform,
  },
};

export const OfUnattached: Story = {
  args: {
    of: ParametersStories.NoParameters,
  },
  parameters: { attached: false },
};

export const Code: Story = {
  args: { code },
};

export const CodeUnattached: Story = {
  args: { code },
  parameters: { attached: false },
};

export const EmptyUnattached: Story = {
  parameters: { attached: false },
};

export const CodeParameters: Story = {
  args: { of: ParametersStories.Code },
};

export const CodeFormat: Story = {
  args: {
    code,
  },
};

export const CodeFormatParameters: Story = {
  args: { of: ParametersStories.CodeFormat },
};

export const CodeLanguage: Story = {
  args: {
    code,
    language: 'graphql',
  },
};

export const CodeLanguageParameters: Story = {
  args: { of: ParametersStories.CodeLanguage },
};

export const Dark: Story = {
  args: { code, dark: true },
};

export const CodeDarkParameters: Story = {
  args: { of: ParametersStories.CodeDark },
};

export const ManyStaticCodeBlocksBenchmark: Story = {
  render: () => <BenchmarkHarness blocks={75} />,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Ensure lazy syntax highlighter/rendering settles before benchmark measurement.
    await waitFor(() => {
      expect(canvas.getAllByRole('button', { name: 'Copy' })).toHaveLength(75);
    });

    await userEvent.click(await canvas.findByTestId('run-benchmark'));

    await waitFor(() => {
      expect(canvas.getByTestId('benchmark-result')).toHaveTextContent(
        /^0 extra renders in \d+(\.\d+)?ms$/
      );
    });
  },
};
