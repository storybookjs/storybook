import type { Meta, StoryObj, StoryContext } from '@storybook/svelte';
import type { StoryName } from '@storybook/types';
import { getContext, hasContext, setContext, type Snippet } from 'svelte';

import type { Story } from '../index.js';

const KEYS = {
  extractor: 'storybook-stories-extractor-context',
  renderer: 'storybook-story-renderer-context',
  renderSnippet: 'storybook-stories-render-snippet-context',
} as const;

export interface StoriesExtractorContextProps<M extends Meta> {
  isExtracting: boolean;
  register: (story: StoryObj<M>) => void;
}

export function buildStoriesExtractorContext<M extends Meta>(
  props: StoriesExtractorContextProps<M>
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

export type RegistrationContext<M extends Meta> = ReturnType<
  typeof buildStoriesExtractorContext<M>
>;

export type StoriesRepository<M extends Meta> = {
  stories: Map<StoryName, StoryObj<M>>;
};

export function createStoriesExtractorContext<M extends Meta>(
  repository: StoriesRepository<M>
): void {
  const { stories } = repository;

  const ctx = buildStoriesExtractorContext<M>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.name as string, s);
    },
  });

  setContext(KEYS.extractor, ctx);
}

export function useStoriesExtractor<M extends Meta>() {
  if (!hasContext(KEYS.extractor)) {
    setContext(
      KEYS.extractor,
      buildStoriesExtractorContext({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<RegistrationContext<M>>(KEYS.extractor);
}

interface StoryRendererContextProps<M extends Meta> {
  currentStoryName: StoryName | undefined;
  args: StoryObj<M>['args'];
  storyContext: StoryContext<StoryObj<M>['args']>;
}

function buildStoryRendererContext<M extends Meta>(props: StoryRendererContextProps<M>) {
  let currentStoryName = $state(props.currentStoryName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: StoryRendererContextProps<M>) {
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

export type StoryRendererContext<M extends Meta> = ReturnType<typeof buildStoryRendererContext<M>>;

function createStoryRendererContext<M extends Meta>(): void {
  const ctx = buildStoryRendererContext<M>({
    currentStoryName: undefined,
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(KEYS.renderer, ctx);
}

export function useStoryRenderer<M extends Meta>() {
  if (!hasContext(KEYS.renderer)) {
    createStoryRendererContext<M>();
  }

  return getContext<StoryRendererContext<M>>(KEYS.renderer);
}

function createStoriesTemplateContext<M extends Meta>() {
  let template = $state<Snippet<[StoryObj<M>['args'], StoryContext<M['args']>]> | undefined>();

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

type StoriesTemplateContext<M extends Meta> = ReturnType<typeof createStoriesTemplateContext<M>>;

export function useStoriesTemplate<M extends Meta>() {
  if (!hasContext(KEYS.renderSnippet)) {
    setContext(KEYS.renderSnippet, createStoriesTemplateContext<M>());
  }

  return getContext<StoriesTemplateContext<M>>(KEYS.renderSnippet).template;
}

type InferMeta<S extends Story<Meta>> = S extends Story<infer M extends Meta> ? M : never;

export function setTemplate<S extends Story<Meta>>(
  snippet?: StoriesTemplateContext<InferMeta<S>>['template']
): void {
  if (!hasContext(KEYS.renderSnippet)) {
    setContext(KEYS.renderSnippet, createStoriesTemplateContext<InferMeta<S>>());
  }

  const ctx = getContext<StoriesTemplateContext<InferMeta<S>>>(KEYS.renderSnippet);

  ctx.set(snippet);
}
