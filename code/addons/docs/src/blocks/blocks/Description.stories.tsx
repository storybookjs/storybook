import type {
  DocgenPayload,
  ModuleExport,
  StoryContext,
  StoryDocsPayload,
} from 'storybook/internal/types';
import { registerService } from 'storybook/preview-api';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, waitFor } from 'storybook/test';
import invariant from 'tiny-invariant';

import { Button as ButtonComponent } from '../examples/Button';
import * as DefaultButtonStories from '../examples/Button.stories';
import * as ButtonStoriesWithMetaDescriptionAsBoth from '../examples/ButtonWithMetaDescriptionAsBoth.stories';
import * as ButtonStoriesWithMetaDescriptionAsComment from '../examples/ButtonWithMetaDescriptionAsComment.stories';
import * as ButtonStoriesWithMetaDescriptionAsParameter from '../examples/ButtonWithMetaDescriptionAsParameter.stories';
import * as ParametersStories from '../examples/SourceParameters.stories.tsx';
import { Description } from './Description';
import type { DocsContextProps } from './DocsContext.ts';
import { docgenServiceDef } from '../../../../../core/src/shared/open-service/services/docgen/definition.ts';
import { storyDocsServiceDef } from '../../../../../core/src/shared/open-service/services/story-docs/definition.ts';
import { unregisterService } from '../../../../../core/src/shared/open-service/service-registry.ts';

type StoryDocsMockData = {
  description?: string;
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
    stories: {
      [story.id]: {
        id: story.id,
        name: story.name,
        ...(data.description ? { description: data.description } : {}),
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
    globalThis.FEATURES = { ...previousFeatures, docgenServer: true };

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

type DocgenMockData = Pick<DocgenPayload, 'description' | 'docsDescription'>;

function docgenServiceBeforeEach(of: ModuleExport, data: DocgenMockData) {
  return async (context: StoryContext) => {
    const docsContext = context.loaded?.docsContext as DocsContextProps | undefined;
    invariant(docsContext, 'docsContext is required to mock docgen for docs block stories');

    // Same reason as the story-docs mock: the block only reads the service behind this feature.
    const previousFeatures = globalThis.FEATURES;
    globalThis.FEATURES = { ...previousFeatures, docgenServer: true };

    const { preparedMeta } = docsContext.resolveOf(of, ['meta']);
    const payload: DocgenPayload = {
      id: preparedMeta.componentId,
      name: preparedMeta.componentId,
      path: './example.stories.tsx',
      jsDocTags: {},
      ...data,
    };
    unregisterService('core/docgen');
    const service = registerService(docgenServiceDef, {
      commands: {
        extractDocgen: {
          handler: (_input, ctx) => {
            ctx.self.setState((state) => {
              state.components[payload.id] = payload;
            });
            return payload;
          },
        },
        extractAllDocgen: {
          handler: (_input, ctx) => {
            ctx.self.setState((state) => {
              state.components[payload.id] = payload;
            });
          },
        },
      },
    });
    await service.commands.extractDocgen({ id: payload.id });

    return () => {
      unregisterService('core/docgen');
      globalThis.FEATURES = previousFeatures;
    };
  };
}

const SERVICE_STORY_DESCRIPTION = 'Description from the story-docs service';
const DOCGEN_DESCRIPTION = 'Description from the docgen service';
const DOCGEN_EXAMPLE = '<app-empty-example />';

const meta = {
  component: Description,
  parameters: {
    layout: 'fullscreen',
    controls: {
      include: [],
    },
    // workaround for https://github.com/storybookjs/storybook/issues/20505
    docs: { source: { type: 'code' } },
    attached: false,
    docsStyles: true,
  },
} satisfies Meta<typeof Description>;
export default meta;

type Story = StoryObj<typeof meta>;

export const OfComponentAsComponentComment: Story = {
  args: {
    of: ButtonComponent,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfCSFFileAsComponentComment: Story = {
  args: {
    of: DefaultButtonStories,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfCSFFileAsMetaComment: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsComment,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsComment.stories'],
  },
};
export const OfCSFFileAsParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsParameter,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsParameter.stories'],
  },
};
export const OfCSFFileAsMetaCommentAndParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsBoth,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsBoth.stories'],
  },
};
export const OfMetaAsComponentComment: Story = {
  args: {
    of: DefaultButtonStories.default,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfMetaAsMetaComment: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsComment.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsComment.stories'],
  },
};
export const OfMetaAsParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsParameter.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsParameter.stories'],
  },
};
export const OfMetaAsMetaCommentAndParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsBoth.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsBoth.stories'],
  },
};
export const OfStoryAsComment: Story = {
  args: {
    of: DefaultButtonStories.Primary,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfStoryAsParameter: Story = {
  args: {
    of: DefaultButtonStories.Secondary,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfStoryAsStoryCommentAndParameter: Story = {
  args: {
    of: DefaultButtonStories.Large,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};

export const OfStoryFromStoryDocsService: Story = {
  args: {
    of: ParametersStories.NoParameters,
  },
  parameters: { relativeCsfPaths: ['../examples/SourceParameters.stories'] },
  beforeEach: storyDocsServiceStoryBeforeEach(ParametersStories.NoParameters, {
    description: SERVICE_STORY_DESCRIPTION,
  }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(SERVICE_STORY_DESCRIPTION);
  },
};

export const OfCSFFileWithDocgenDocsDescription: Story = {
  args: {
    of: ParametersStories,
  },
  parameters: { relativeCsfPaths: ['../examples/SourceParameters.stories'] },
  beforeEach: docgenServiceBeforeEach(ParametersStories, {
    description: DOCGEN_DESCRIPTION,
    docsDescription: `${DOCGEN_DESCRIPTION}\n\n\`\`\`html\n${DOCGEN_EXAMPLE}\n\`\`\``,
  }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(DOCGEN_DESCRIPTION);
    // The code block's syntax highlighter loads asynchronously.
    await waitFor(() => expect(canvasElement).toHaveTextContent(DOCGEN_EXAMPLE));
  },
};

export const OfCSFFileAsParameterWinsOverDocgenDocsDescription: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsParameter,
  },
  parameters: { relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsParameter.stories'] },
  beforeEach: docgenServiceBeforeEach(ButtonStoriesWithMetaDescriptionAsParameter, {
    description: DOCGEN_DESCRIPTION,
    docsDescription: `${DOCGEN_DESCRIPTION}\n\n\`\`\`html\n${DOCGEN_EXAMPLE}\n\`\`\``,
  }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('These are the stories for the Button component');
    await expect(canvasElement).not.toHaveTextContent(DOCGEN_EXAMPLE);
  },
};

export const DefaultAttached: Story = {
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfUndefinedAttached: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    of: DefaultButtonStories.NotDefined,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
    relativeCsfPaths: ['../examples/Button.stories'],
    attached: true,
  },
  tags: ['!test'],
};
export const OfStringComponentAttached: Story = {
  name: 'Of "component" Attached',
  args: {
    of: 'component',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfStringMetaAttached: Story = {
  name: 'Of "meta" Attached',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfStringStoryAttached: Story = {
  name: 'Of "story" Attached',
  args: {
    of: 'story',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
