import type { ComponentProps, ComponentType } from 'react';

import { composeConfigs } from 'storybook/internal/preview-api';
import { normalizeProjectAnnotations } from 'storybook/internal/preview-api';
import type {
  Args,
  ComponentAnnotations,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
  StoryContext,
} from 'storybook/internal/types';

import type { SetOptional } from 'type-fest';

import * as reactAnnotations from './entry-preview';
import * as reactDocsAnnotations from './entry-preview-docs';
import type { ReactRenderer } from './types';

export function definePreview(config: PreviewConfigData<ReactRenderer>) {
  return new PreviewConfig({
    ...config,
    addons: [reactAnnotations, reactDocsAnnotations, ...(config.addons ?? [])],
  });
}

interface PreviewConfigData<TRenderer extends Renderer> extends ProjectAnnotations<TRenderer> {
  addons?: ProjectAnnotations<TRenderer>[];
}

class PreviewConfig<TRenderer extends Renderer> {
  readonly input: NormalizedProjectAnnotations<TRenderer>;

  constructor(data: PreviewConfigData<TRenderer>) {
    const { addons, ...rest } = data;
    this.input = normalizeProjectAnnotations(composeConfigs([...(addons ?? []), rest]));
  }

  readonly meta = <
    TComponent extends ComponentType<any>,
    TMetaArgs extends Partial<ComponentProps<TComponent>>,
  >(
    meta: ComponentAnnotations<TRenderer, any> & { component: TComponent; args: TMetaArgs }
  ) => {
    return new Meta<TRenderer, ComponentProps<TComponent>, TMetaArgs>(meta, this);
  };

  readonly isCSFFactoryPreview = true;
}

class Meta<TRenderer extends Renderer, TArgs extends Args, TRequiredArgs extends Args> {
  readonly input: ComponentAnnotations<TRenderer, TArgs>;

  readonly config: PreviewConfig<TRenderer>;

  constructor(annotations: ComponentAnnotations<TRenderer, any>, config: PreviewConfig<TRenderer>) {
    this.input = annotations;
    this.config = config;
  }

  readonly story = (
    story: StoryAnnotations<TRenderer, TArgs, SetOptional<TArgs, keyof TArgs & keyof TRequiredArgs>>
  ) => new Story(story as any, this, this.config);
}

class Story<TRenderer extends Renderer, TArgs extends Args, TRequiredArgs extends Args> {
  readonly isCSFFactory = true;

  constructor(
    public input: StoryAnnotations<TRenderer, TArgs>,
    public meta: Meta<TRenderer, TArgs, TRequiredArgs>,
    public config: PreviewConfig<TRenderer>
  ) {
    this.input.tests = new Map<string, { fn: () => void | Promise<void>; options: any }>();
  }

  test(name: string, fn: (context: StoryContext) => void | Promise<void>, options?: any) {
    this.input.tests?.set(name, { fn, options });
  }

  async runTest(name: string) {
    const test = this.input.tests?.get(name);
    if (!test) {
      throw new Error(`Test with name "${name}" not found.`);
    }
    // TODO: Figure out how to pass the correct context with canvasElement etc.
    // like it's done in portable stories
    await test.fn(this.input);
  }
}
