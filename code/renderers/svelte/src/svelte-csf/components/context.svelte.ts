import type { StoryContext, StoryObj } from '@storybook/svelte';
import type { StoryName } from '@storybook/types';
import {
  getContext,
  hasContext,
  setContext,
  type ComponentProps,
  type Snippet,
  type SvelteComponent,
} from 'svelte';

import type { Template } from '../index.js';

const KEYS = {
  extractor: 'storybook-stories-extractor-context',
  renderer: 'storybook-story-renderer-context',
  renderSnippet: 'storybook-stories-render-snippet-context',
} as const;

export interface StoriesExtractorContextProps<Component extends SvelteComponent = SvelteComponent> {
  isExtracting: boolean;
  register: (story: StoryObj<Component>) => void;
}

export function buildStoriesExtractorContext<Component extends SvelteComponent>(
  props: StoriesExtractorContextProps<Component>
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

export type RegistrationContext<Component extends SvelteComponent> = ReturnType<
  typeof buildStoriesExtractorContext<Component>
>;

export type StoriesRepository<Component extends SvelteComponent> = {
  stories: Map<StoryName, StoryObj<Component>>;
};

export function createStoriesExtractorContext<Component extends SvelteComponent>(
  repository: StoriesRepository<Component>
): void {
  const { stories } = repository;

  const ctx = buildStoriesExtractorContext<Component>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.name as string, s);
    },
  });

  setContext(KEYS.extractor, ctx);
}

export function useStoriesExtractor<Component extends SvelteComponent>() {
  if (!hasContext(KEYS.extractor)) {
    setContext(
      KEYS.extractor,
      buildStoriesExtractorContext({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<RegistrationContext<Component>>(KEYS.extractor);
}

interface StoryRendererContextProps<Component extends SvelteComponent> {
  currentStoryName: StoryName | undefined;
  args: NonNullable<Partial<ComponentProps<Component>>>;
  storyContext: StoryContext<ComponentProps<Component>>;
}

function buildStoryRendererContext<Component extends SvelteComponent>(
  props: StoryRendererContextProps<Component>
) {
  let currentStoryName = $state(props.currentStoryName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: StoryRendererContextProps<Component>) {
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

export type StoryRendererContext<Component extends SvelteComponent> = ReturnType<
  typeof buildStoryRendererContext<Component>
>;

function createStoryRendererContext<Component extends SvelteComponent>(): void {
  const ctx = buildStoryRendererContext<Component>({
    currentStoryName: undefined,
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(KEYS.renderer, ctx);
}

export function useStoryRenderer<Component extends SvelteComponent>() {
  if (!hasContext(KEYS.renderer)) {
    createStoryRendererContext<Component>();
  }

  return getContext<StoryRendererContext<Component>>(KEYS.renderer);
}

function createStoriesTemplateContext<Component extends SvelteComponent>() {
  let template = $state<Snippet<[Template<Component>]> | undefined>();

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

type StoriesTemplateContext<Component extends SvelteComponent> = ReturnType<
  typeof createStoriesTemplateContext<Component>
>;

export function useStoriesTemplate<Component extends SvelteComponent>() {
  if (!hasContext(KEYS.renderSnippet)) {
    setContext(KEYS.renderSnippet, createStoriesTemplateContext<Component>());
  }

  return getContext<StoriesTemplateContext<Component>>(KEYS.renderSnippet).template;
}

export function setTemplate<Component extends SvelteComponent>(
  snippet?: StoriesTemplateContext<Component>['template']
): void {
  if (!hasContext(KEYS.renderSnippet)) {
    setContext(KEYS.renderSnippet, createStoriesTemplateContext<Component>());
  }

  const ctx = getContext<StoriesTemplateContext<Component>>(KEYS.renderSnippet);

  ctx.set(snippet);
}
