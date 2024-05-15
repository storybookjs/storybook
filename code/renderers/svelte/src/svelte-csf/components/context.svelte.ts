import type { Meta, StoryContext, StoryObj, SvelteRenderer } from '@storybook/svelte';
import type { ComponentAnnotations, StoryName } from '@storybook/types';
import {
  getContext,
  hasContext,
  setContext,
  type ComponentProps,
  type SvelteComponent,
} from 'svelte';
import type { SetRequired } from 'type-fest';

const KEYS = {
  extractor: 'storybook-stories-extractor-context',
  renderer: 'storybook-story-renderer-context',
} as const;

export interface StoriesExtractorContextProps<Component extends SvelteComponent = SvelteComponent> {
  isExtracting: boolean;
  register: {
    template: (template: AddonTemplateObj<Component>) => void;
    story: (story: AddonStoryObj<Component>) => void;
  };
}

export type AddonTemplateObj<Component extends SvelteComponent> = Omit<
  StoryObj<Component>,
  'render'
> & {
  id: string;
};

export type AddonStoryObj<Component extends SvelteComponent> = Omit<
  SetRequired<StoryObj<Component>, 'name'>,
  'render'
> & {
  templateId?: AddonTemplateObj<Component>['id'];
};

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
  templates: Map<string, AddonTemplateObj<Component>>;
  stories: Map<StoryName, AddonStoryObj<Component>>;
};

export function createStoriesExtractorContext<Component extends SvelteComponent>(
  repository: StoriesRepository<Component>
): void {
  const { templates, stories } = repository;

  const ctx = buildStoriesExtractorContext<Component>({
    isExtracting: true,
    register: {
      template: (t) => {
        templates.set(t.id, t);
      },
      story: (s) => {
        stories.set(s.name, s);
      },
    },
  });

  setContext(KEYS.extractor, ctx);
}

export function useStoriesExtractorContext<Component extends SvelteComponent>() {
  if (!hasContext(KEYS.extractor)) {
    setContext(
      KEYS.extractor,
      buildStoriesExtractorContext({
        isExtracting: false,
        register: {
          template: () => {},
          story: () => {},
        },
      })
    );
  }

  return getContext<RegistrationContext<Component>>(KEYS.extractor);
}

interface StoryRendererContextProps<Component extends SvelteComponent> {
  componentAnnotations: ComponentAnnotations<SvelteRenderer<SvelteComponent<Component>>>;
  storyContext: StoryContext<ComponentProps<Component>>;
  currentTemplateId: string | undefined;
  currentStoryName: StoryName | undefined;
}

function buildStoryRendererContext<Component extends SvelteComponent>(
  props: StoryRendererContextProps<Component>
) {
  let currentStoryName = $state(props.currentStoryName);
  let currentTemplateId = $state(props.currentTemplateId);
  let storyContext = $state(props.storyContext);
  let componentAnnotations = $state(props.componentAnnotations);

  function set(props: StoryRendererContextProps<Component>) {
    currentStoryName = props.currentStoryName;
    currentTemplateId = props.currentTemplateId;
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
    get currentTemplateId() {
      return currentTemplateId;
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
    currentTemplateId: undefined,
    componentAnnotations: {},
    // FIXME: What is missing to be done to satisfy the default?
    storyContext: {},
  });

  setContext(KEYS.renderer, ctx);
}

export function useStoryRendererContext<Component extends SvelteComponent>() {
  if (!hasContext(KEYS.renderer)) {
    createStoryRendererContext<Component>();
  }

  return getContext<StoryRendererContext<Component>>(KEYS.renderer);
}
