import type { Meta, StoryObj, StoryContext } from '@storybook/svelte';
import type { StoryName } from '@storybook/types';
import { getContext, hasContext, setContext, type Snippet } from 'svelte';

import type { Story } from '../index.js';

const ContextKeys = {
  EXTRACTOR: 'storybook-stories-extractor-context',
  RENDERER: 'storybook-story-renderer-context',
  TEMPLATE_SNIPPET: 'storybook-stories-template-snippet-context',
} as const;

export interface StoriesExtractorContextProps<TMeta extends Meta> {
  isExtracting: boolean;
  register: (story: StoryObj<TMeta>) => void;
}

function buildStoriesExtractorContext<TMeta extends Meta>(
  props: StoriesExtractorContextProps<TMeta>
) {
  let isExtracting = $state(props.isExtracting);
  let register = $state(props.register);

  return {
    get isExtracting() {
      return isExtracting;
    },
    get register() {
      return register;
    },
  };
}

export type RegistrationContext<TMeta extends Meta> = ReturnType<
  typeof buildStoriesExtractorContext<TMeta>
>;

export type StoriesRepository<TMeta extends Meta> = {
  stories: Map<StoryName, StoryObj<TMeta>>;
};

export function createStoriesExtractorContext<TMeta extends Meta>(
  repository: StoriesRepository<TMeta>
): void {
  const { stories } = repository;

  const ctx = buildStoriesExtractorContext<TMeta>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.name as string, s);
    },
  });

  setContext(ContextKeys.EXTRACTOR, ctx);
}

export function useStoriesExtractor<TMeta extends Meta>() {
  if (!hasContext(ContextKeys.EXTRACTOR)) {
    setContext(
      ContextKeys.EXTRACTOR,
      buildStoriesExtractorContext({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<RegistrationContext<TMeta>>(ContextKeys.EXTRACTOR);
}

interface StoryRendererContextProps<TMeta extends Meta> {
  currentStoryName: StoryName | undefined;
  args: StoryObj<TMeta>['args'];
  storyContext: StoryContext<StoryObj<TMeta>['args']>;
}

function buildStoryRendererContext<TMeta extends Meta>(props: StoryRendererContextProps<TMeta>) {
  let currentStoryName = $state(props.currentStoryName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: StoryRendererContextProps<TMeta>) {
    currentStoryName = props.currentStoryName;
    args = props.args;
    storyContext = props.storyContext;
  }

  return {
    get args() {
      return args;
    },
    get storyContext() {
      return storyContext;
    },
    get currentStoryName() {
      return currentStoryName;
    },
    set,
  };
}

export type StoryRendererContext<TMeta extends Meta> = ReturnType<typeof buildStoryRendererContext<TMeta>>;

function createStoryRendererContext<TMeta extends Meta>(): void {
  const ctx = buildStoryRendererContext<TMeta>({
    currentStoryName: undefined,
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(ContextKeys.RENDERER, ctx);
}

export function useStoryRenderer<TMeta extends Meta>() {
  if (!hasContext(ContextKeys.RENDERER)) {
    createStoryRendererContext<TMeta>();
  }

  return getContext<StoryRendererContext<TMeta>>(ContextKeys.RENDERER);
}

function createStoriesTemplateContext<TMeta extends Meta>() {
  let template = $state<Snippet<[StoryObj<TMeta>['args'], StoryContext<TMeta['args']>]> | undefined>();

  function set(snippet?: typeof template) {
    template = snippet;
  }

  return {
    get template() {
      return template;
    },
    set,
  };
}

type StoriesTemplateContext<TMeta extends Meta> = ReturnType<typeof createStoriesTemplateContext<TMeta>>;

export function useStoriesTemplate<TMeta extends Meta>() {
  if (!hasContext(ContextKeys.TEMPLATE_SNIPPET)) {
    setContext(ContextKeys.TEMPLATE_SNIPPET, createStoriesTemplateContext<TMeta>());
  }

  return getContext<StoriesTemplateContext<TMeta>>(ContextKeys.TEMPLATE_SNIPPET).template;
}

type InferMeta<TStory extends Story<Meta>> = TStory extends Story<infer TMeta extends Meta> ? TMeta : never;

export function setTemplate<TStory extends Story<Meta>>(
  snippet?: StoriesTemplateContext<InferMeta<TStory>>['template']
): void {
  if (!hasContext(ContextKeys.TEMPLATE_SNIPPET)) {
    setContext(ContextKeys.TEMPLATE_SNIPPET, createStoriesTemplateContext<InferMeta<TStory>>());
  }

  const ctx = getContext<StoriesTemplateContext<InferMeta<TStory>>>(ContextKeys.TEMPLATE_SNIPPET);

  ctx.set(snippet);
}
