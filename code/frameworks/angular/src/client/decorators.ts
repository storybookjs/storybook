import { DecoratorFunction, StoryContext } from 'storybook/internal/types';

import { Type } from '@angular/core';
import { ApplicationConfig } from '@angular/platform-browser';

import { computesTemplateFromComponent } from './angular-beta/ComputesTemplateFromComponent';
import { isComponent } from './angular-beta/utils/NgComponentAnalyzer';
import { AngularRenderer, ICollection, NgModuleMetadata } from './types';

// We use `any` here as the default type rather than `Args` because we need something that is
// castable to any component-specific args type when the user is being careful.
export const moduleMetadata =
  <TArgs = any>(metadata: Partial<NgModuleMetadata>): DecoratorFunction<AngularRenderer, TArgs> =>
  (storyFn) => {
    const story = storyFn();
    const storyMetadata = story.moduleMetadata || {};
    metadata = metadata || {};

    return {
      ...story,
      moduleMetadata: {
        declarations: [...(metadata.declarations || []), ...(storyMetadata.declarations || [])],
        entryComponents: [
          ...(metadata.entryComponents || []),
          ...(storyMetadata.entryComponents || []),
        ],
        imports: [...(metadata.imports || []), ...(storyMetadata.imports || [])],
        schemas: [...(metadata.schemas || []), ...(storyMetadata.schemas || [])],
        providers: [...(metadata.providers || []), ...(storyMetadata.providers || [])],
      },
    };
  };

/**
 * Decorator to set the config options which are available during the application bootstrap operation
 */
export function applicationConfig<TArgs = any>(
  /**
   * Set of config options available during the application bootstrap operation.
   */
  config: ApplicationConfig
): DecoratorFunction<AngularRenderer, TArgs> {
  return (storyFn) => {
    const story = storyFn();

    const storyConfig: ApplicationConfig | undefined = story.applicationConfig;

    return {
      ...story,
      applicationConfig:
        storyConfig || config
          ? {
              ...config,
              ...storyConfig,
              providers: [...(config?.providers || []), ...(storyConfig?.providers || [])],
            }
          : undefined,
    };
  };
}

export const componentWrapperDecorator =
  <TArgs = any>(
    element: Type<unknown> | ((story: string) => string),
    props?: ICollection | ((storyContext: StoryContext<AngularRenderer, TArgs>) => ICollection)
  ): DecoratorFunction<AngularRenderer, TArgs> =>
  (storyFn, storyContext) => {
    const story = storyFn();
    const currentProps = typeof props === 'function' ? (props(storyContext) as ICollection) : props;

    const template = isComponent(element)
      ? computesTemplateFromComponent(element, currentProps ?? {}, story.template)
      : element(story.template);

    return {
      ...story,
      template,
      ...(currentProps || story.props
        ? {
            props: {
              ...currentProps,
              ...story.props,
            },
          }
        : {}),
    };
  };
