import type { Meta, StoryContext, StoryObj, SvelteRenderer } from '@storybook/svelte';
import type { ComponentAnnotations, StoryName } from '@storybook/types';
import {
  getContext,
  hasContext,
  setContext,
  type ComponentProps,
  type SvelteComponent,
  type Snippet,
} from 'svelte';

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
  meta: Meta<Component>;
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
  componentAnnotations: ComponentAnnotations<SvelteRenderer<SvelteComponent<Component>>>;
  storyContext: StoryContext<ComponentProps<Component>>;
  currentStoryName: StoryName | undefined;
}

function buildStoryRendererContext<Component extends SvelteComponent>(
  props: StoryRendererContextProps<Component>
) {
  let currentStoryName = $state(props.currentStoryName);
  let storyContext = $state(props.storyContext);
  let componentAnnotations = $state(props.componentAnnotations);

  function set(props: StoryRendererContextProps<Component>) {
    currentStoryName = props.currentStoryName;
    componentAnnotations = props.componentAnnotations;
    storyContext = props.storyContext;
  }

  return {
    get componentAnnotations() {
      return componentAnnotations;
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
    componentAnnotations: {},
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

type StoryChildrenTemplate<Component extends SvelteComponent> = Snippet<
  [
    ComponentAnnotations<SvelteRenderer<Component>> & {
      context: StoryContext<ComponentProps<Component>>;
    },
  ]
>;
function createStoryChildrenTemplateContext<Component extends SvelteComponent>() {
  let template = $state<StoryChildrenTemplate<Component>>();

  function set(snippet?: StoryChildrenTemplate<Component>) {
    template = snippet;
  }

  return {
    get template() {
      return template;
    },
    set,
  };
}

type StoryChildrenTemplateContext<Component extends SvelteComponent> = ReturnType<
  typeof createStoryChildrenTemplateContext<Component>
>;

export function useStoryChildrenTemplate<Component extends SvelteComponent>() {
  if (!hasContext(KEYS.renderSnippet)) {
    setContext(KEYS.renderSnippet, createStoryChildrenTemplateContext<Component>());
  }

  return getContext<StoryChildrenTemplateContext<Component>>(KEYS.renderSnippet).template;
}

export function setTemplate<Component extends SvelteComponent>(
  snippet?: StoryChildrenTemplate<Component>
): void {
  if (!hasContext(KEYS.renderSnippet)) {
    setContext(KEYS.renderSnippet, createStoryChildrenTemplateContext<Component>());
  }

  const ctx = getContext<StoryChildrenTemplateContext<Component>>(KEYS.renderSnippet);

  ctx.set(snippet);
}
