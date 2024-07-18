import { Type, NgModule, Component, OnDestroy, AfterViewInit } from '@angular/core';
import { ApplicationConfig } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

import { stringify } from 'telejson';

import { StoryFnAngularReturnType, ICollection } from '../types';
import { AbstractRenderer } from './AbstractRenderer';
import { PropertyExtractor } from './utils/PropertyExtractor';
import { getApplication } from './StorybookModule';
import { storyPropsProvider } from './StorybookProvider';

export class StandaloneRenderer extends AbstractRenderer {
  protected isFirstRender: boolean = true;

  // constructor(public storyId: string) { }

  public getRenderableComponent({
    storyFnAngular,
    forced,
    // parameters
    component,
    targetDOMNode,
  }: {
    storyFnAngular: StoryFnAngularReturnType;
    forced: boolean;
    // parameters: Parameters;
    component?: any;
    targetDOMNode: HTMLElement;
  }): {
    component: Type<any> | null;
    applicationConfig: ApplicationConfig;
  } | null {
    const targetSelector = this.generateTargetSelectorFromStoryId(targetDOMNode.id);

    const newStoryProps$ = new BehaviorSubject<ICollection | undefined>(storyFnAngular.props ?? {});

    // Storybook now retrieves the component from the context, so this is a workaround to preserve the component in composed stories.
    // eslint-disable-next-line no-underscore-dangle
    const storyComponent = component || (storyFnAngular as any)._composedComponent;

    if (
      !this.fullRendererRequired({
        targetDOMNode,
        storyFnAngular,
        moduleMetadata: {
          ...storyFnAngular.moduleMetadata,
        },
        forced,
      })
    ) {
      this.storyProps$.next(storyFnAngular.props);
      this.isFirstRender = false;
      return null;
    }

    if (!this.isFirstRender) {
      return null;
    }

    this.storyProps$ = newStoryProps$;

    const analyzedMetadata = new PropertyExtractor(
      storyFnAngular.moduleMetadata || {},
      storyComponent
    );

    return {
      component: getApplication({
        storyFnAngular,
        component: storyComponent,
        targetSelector,
        analyzedMetadata,
      }),
      applicationConfig: {
        ...storyFnAngular.applicationConfig,
        providers: [
          storyPropsProvider(newStoryProps$),
          ...(analyzedMetadata.applicationProviders ?? []),
          ...(storyFnAngular.applicationConfig?.providers ?? []),
        ],
      },
    };
  }

  public completeStory(): void {
    // Complete last BehaviorSubject and set a new one for the current module
    if (this.storyProps$) {
      this.storyProps$.complete();
    }
  }

  async beforeFullRender(domNode?: HTMLElement): Promise<void> {}
}

export interface RenderableStoryAndModule {
  component: any;
  applicationConfig: ApplicationConfig;
}

/**
 * Function that will receive a StoryFnAngularReturnType and will return a Component and NgModule that renders the story.
 *
 * @param story
 * @returns
 */
export function createMountable(storyFnReturn: StoryFnAngularReturnType): RenderableStoryAndModule {
  const storyId = `storybook-testing-wrapper`;
  const renderer = new StandaloneRenderer();

  const domNode = document.createElement('span');
  domNode.id = storyId;

  const story: StoryFnAngularReturnType = {
    ...(storyFnReturn as any),
    moduleMetadata: {
      declarations: [...((storyFnReturn as any).moduleMetadata?.declarations ?? [])],
      imports: [...((storyFnReturn as any).moduleMetadata?.imports ?? [])],
      providers: [...((storyFnReturn as any).moduleMetadata?.providers ?? [])],
      entryComponents: [...((storyFnReturn as any).moduleMetadata?.entryComponents ?? [])],
      schemas: [...((storyFnReturn as any).moduleMetadata?.schemas ?? [])],
    },
  };

  const componentAndConfig = renderer.getRenderableComponent({
    storyFnAngular: story,
    forced: false,
    // parameters: {} as any,
    targetDOMNode: domNode,
  });

  // This additional wrapper can probably be avoided by making some changes to
  // the renderer or wrapper component in '@storybook/angular'.
  @Component({
    selector: 'sb-testing-mountable',
    template: `<${storyId}></${storyId}>`,
    imports: [(componentAndConfig as any).component],
    standalone: true,
  })
  class SbTestingMountable implements OnDestroy, AfterViewInit {
    ngOnDestroy(): void {
      renderer.completeStory();
    }

    ngAfterViewInit(): void {
      const domNodeInner = document.createElement('span');
      domNodeInner.id = storyId;
      renderer.getRenderableComponent({
        storyFnAngular: storyFnReturn as any,
        forced: false,
        // parameters: {} as any,
        targetDOMNode: domNodeInner,
      });
    }
  }

  if (componentAndConfig === null) {
    throw Error(`Must initially have module`);
  }

  return {
    component: SbTestingMountable,
    applicationConfig: componentAndConfig.applicationConfig,
  };
}
