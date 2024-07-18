import { ApplicationRef, enableProdMode, NgModule } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { BehaviorSubject, Subject } from 'rxjs';
import { stringify } from 'telejson';

import { ICollection, StoryFnAngularReturnType } from '../types';
import { getApplication } from './StorybookModule';
import { storyPropsProvider } from './StorybookProvider';
import { PropertyExtractor } from './utils/PropertyExtractor';
import { queueBootstrapping } from './utils/BootstrapQueue';

type StoryRenderInfo = {
  storyFnAngular: StoryFnAngularReturnType;
  moduleMetadataSnapshot: string;
};

const applicationRefs = new Map<HTMLElement, ApplicationRef>();

/**
 * Attribute name for the story UID that may be written to the targetDOMNode.
 *
 * If a target DOM node has a story UID attribute, it will be used as part of
 * the selector for the Angular component.
 */
export const STORY_UID_ATTRIBUTE = 'data-sb-story-uid';

export abstract class AbstractRenderer {
  /**
   * Wait and destroy the platform
   */
  public static resetApplications(domNode?: HTMLElement) {
    applicationRefs.forEach((appRef, appDOMNode) => {
      if (!appRef.destroyed && (!domNode || appDOMNode === domNode)) {
        appRef.destroy();
      }
    });
  }

  protected previousStoryRenderInfo = new Map<HTMLElement, StoryRenderInfo>();

  // Observable to change the properties dynamically without reloading angular module&component
  protected storyProps$: Subject<ICollection | undefined>;

  protected abstract beforeFullRender(domNode?: HTMLElement): Promise<void>;

  /**
   * Bootstrap main angular module with main component or send only new `props` with storyProps$
   *
   * @param storyFnAngular {StoryFnAngularReturnType}
   * @param forced {boolean} If :
   * - true render will only use the StoryFn `props' in storyProps observable that will update sotry's component/template properties. Improves performance without reloading the whole module&component if props changes
   * - false fully recharges or initializes angular module & component
   * @param component {Component}
   */
  public async render({
    storyFnAngular,
    forced,
    component,
    targetDOMNode,
  }: {
    storyFnAngular: StoryFnAngularReturnType;
    forced: boolean;
    component?: any;
    targetDOMNode: HTMLElement;
  }) {
    const targetSelector = this.generateTargetSelectorFromStoryId(targetDOMNode.id);

    const newStoryProps$ = new BehaviorSubject<ICollection>(storyFnAngular.props);

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

      return;
    }

    await this.beforeFullRender(targetDOMNode);

    // Complete last BehaviorSubject and set a new one for the current module
    if (this.storyProps$) {
      this.storyProps$.complete();
    }
    this.storyProps$ = newStoryProps$;

    this.initAngularRootElement(targetDOMNode, targetSelector);

    const analyzedMetadata = new PropertyExtractor(storyFnAngular.moduleMetadata, component);

    const storyUid = targetDOMNode.getAttribute(STORY_UID_ATTRIBUTE);
    const componentSelector = storyUid !== null ? `${targetSelector}[${storyUid}]` : targetSelector;
    if (storyUid !== null) {
      const element = targetDOMNode.querySelector(targetSelector);
      element.toggleAttribute(storyUid, true);
    }

    const application = getApplication({
      storyFnAngular,
      component,
      targetSelector: componentSelector,
      analyzedMetadata,
    });

    const applicationRef = await queueBootstrapping(() => {
      return bootstrapApplication(application, {
        ...storyFnAngular.applicationConfig,
        providers: [
          storyPropsProvider(newStoryProps$),
          ...analyzedMetadata.applicationProviders,
          ...(storyFnAngular.applicationConfig?.providers ?? []),
        ],
      });
    });

    applicationRefs.set(targetDOMNode, applicationRef);
  }

  /**
   * Only ASCII alphanumerics can be used as HTML tag name.
   * https://html.spec.whatwg.org/#elements-2
   *
   * Therefore, stories break when non-ASCII alphanumerics are included in target selector.
   * https://github.com/storybookjs/storybook/issues/15147
   *
   * This method returns storyId when it doesn't contain any non-ASCII alphanumerics.
   * Otherwise, it generates a valid HTML tag name from storyId by removing non-ASCII alphanumerics from storyId, prefixing "sb-", and suffixing "-component"
   * @protected
   * @memberof AbstractRenderer
   */
  protected generateTargetSelectorFromStoryId(id: string) {
    const invalidHtmlTag = /[^A-Za-z0-9-]/g;
    const storyIdIsInvalidHtmlTagName = invalidHtmlTag.test(id);
    return storyIdIsInvalidHtmlTagName ? `sb-${id.replace(invalidHtmlTag, '')}-component` : id;
  }

  /**
   * Adds DOM element that angular will use as bootstrap component.
   */
  protected initAngularRootElement(targetDOMNode: HTMLElement, targetSelector: string) {
    targetDOMNode.innerHTML = '';
    targetDOMNode.appendChild(document.createElement(targetSelector));
  }

  protected fullRendererRequired({
    targetDOMNode,
    storyFnAngular,
    moduleMetadata,
    forced,
  }: {
    targetDOMNode: HTMLElement;
    storyFnAngular: StoryFnAngularReturnType;
    moduleMetadata: NgModule;
    forced: boolean;
  }) {
    const previousStoryRenderInfo = this.previousStoryRenderInfo.get(targetDOMNode);

    const currentStoryRender = {
      storyFnAngular,
      moduleMetadataSnapshot: stringify(moduleMetadata, { allowFunction: false }),
    };

    this.previousStoryRenderInfo.set(targetDOMNode, currentStoryRender);

    if (
      // check `forceRender` of story RenderContext
      !forced ||
      // if it's the first rendering and storyProps$ is not init
      !this.storyProps$
    ) {
      return true;
    }

    // force the rendering if the template has changed
    const hasChangedTemplate =
      !!storyFnAngular?.template &&
      previousStoryRenderInfo?.storyFnAngular?.template !== storyFnAngular.template;
    if (hasChangedTemplate) {
      return true;
    }

    // force the rendering if the metadata structure has changed
    const hasChangedModuleMetadata =
      currentStoryRender.moduleMetadataSnapshot !== previousStoryRenderInfo?.moduleMetadataSnapshot;

    return hasChangedModuleMetadata;
  }
}
