import { ApplicationRef, NgModule } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { stringify } from 'telejson';
import { ICollection, StoryFnAngularReturnType } from '../types';
import { PropertyExtractor } from './utils/PropertyExtractor';
import { TestBedComponentBuilder } from './utils/TestBedComponentBuilder';;
import { queueBootstrapping } from './utils/BootstrapQueue';
import { bootstrapApplication } from '@angular/platform-browser';
import { getWrapperComponent } from './TestBedWrapperComponent';
import { storyPropsProvider } from './StorybookProvider';
import { getApplication } from './StorybookModule';

type StoryRenderInfo = {
  storyFnAngular: StoryFnAngularReturnType;
  moduleMetadataSnapshot: string;
};

declare global {
  const STORYBOOK_ANGULAR_OPTIONS: {
    experimentalZoneless: boolean;
  };
}

const applicationRefs = new Map<HTMLElement, ApplicationRef>();
/**
 * Attribute name for the story UID that may be written to the targetDOMNode.
 *
 * If a target DOM node has a story UID attribute, it will be used as part of the selector for the
 * Angular component.
 */
export const STORY_UID_ATTRIBUTE = 'data-sb-story-uid';

export abstract class AbstractRenderer {
  /** Wait and destroy the platform */
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
   *
   *   - True render will only use the StoryFn `props' in storyProps observable that will update sotry's
   *       component/template properties. Improves performance without reloading the whole
   *       module&component if props changes
   *   - False fully recharges or initializes angular module & component
   *
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

    const { environmentProviders, componentSelector, analyzedMetadata } =
      await this.prepareMetaData(storyFnAngular, targetDOMNode, component);
    environmentProviders.push(storyPropsProvider(newStoryProps$));

    // Complete last BehaviorSubject and set a new one for the current module
    if (this.storyProps$) {
      this.storyProps$.complete();
    }
    this.storyProps$ = newStoryProps$;

    const application = getApplication({
      storyFnAngular,
      component,
      targetSelector: componentSelector,
      analyzedMetadata,
    });

    const applicationRef = await queueBootstrapping(() => {
      return bootstrapApplication(application, {
        ...storyFnAngular.applicationConfig,
        providers: environmentProviders,
      });
    });

    this.setApplicationRef(targetDOMNode, applicationRef);
  }

  /**
   * Bootstrap main angular module with main component with testbed api
   *
   * @param storyFnAngular {StoryFnAngularReturnType}
   * @param forced {boolean}
   * @param component {Component}
   */
  public async renderWithTestBed({
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
    const { environmentProviders, componentSelector, analyzedMetadata } =
      await this.prepareMetaData(storyFnAngular, targetDOMNode, component);

    if (storyFnAngular.userDefinedTemplate) {
      component = getWrapperComponent(storyFnAngular.template);
    }

    const componentBuilder = await new TestBedComponentBuilder()
      .setComponent(component)
      .setSelector(componentSelector)
      .setStoryFn(storyFnAngular)
      .setMetaData(analyzedMetadata)
      .setTargetNode(targetDOMNode)
      .setEnvironmentProviders(environmentProviders)
      .configure()
      .initRouter()
      .compileComponents();

    componentBuilder.copyComponentIntoTargetNode();

    this.setApplicationRef(targetDOMNode, componentBuilder.getApplicationRef());
  }

  public setApplicationRef(targetDOMNode: HTMLElement, applicationRef: ApplicationRef) {
    applicationRefs.set(targetDOMNode, applicationRef);
  }

  private async prepareMetaData(
    storyFnAngular: StoryFnAngularReturnType,
    targetDOMNode: HTMLElement,
    component?: any
  ) {
    const targetSelector = this.generateTargetSelectorFromStoryId(targetDOMNode.id);

    await this.beforeFullRender();

    this.initAngularRootElement(targetDOMNode, targetSelector);

    const analyzedMetadata = new PropertyExtractor(storyFnAngular.moduleMetadata, component);
    await analyzedMetadata.init();

    const storyUid = this.generateStoryUIdFromRawStoryUid(
      targetDOMNode.getAttribute(STORY_UID_ATTRIBUTE)
    );
    const componentSelector = storyUid !== null ? `${targetSelector}[${storyUid}]` : targetSelector;
    if (storyUid !== null) {
      const element = targetDOMNode.querySelector(targetSelector);
      element.toggleAttribute(storyUid, true);
    }

    const environmentProviders = [
      ...analyzedMetadata.applicationProviders,
      ...(storyFnAngular.applicationConfig?.providers ?? []),
    ];

    if (STORYBOOK_ANGULAR_OPTIONS?.experimentalZoneless) {
      const { provideExperimentalZonelessChangeDetection } = await import('@angular/core');
      if (!provideExperimentalZonelessChangeDetection) {
        throw new Error('Experimental zoneless change detection requires Angular 18 or higher');
      } else {
        environmentProviders.unshift(provideExperimentalZonelessChangeDetection());
      }
    }

    return {
      environmentProviders,
      componentSelector,
      analyzedMetadata,
    };
  }

  /**
   * Only ASCII alphanumerics can be used as HTML tag name. https://html.spec.whatwg.org/#elements-2
   *
   * Therefore, stories break when non-ASCII alphanumerics are included in target selector.
   * https://github.com/storybookjs/storybook/issues/15147
   *
   * This method returns storyId when it doesn't contain any non-ASCII alphanumerics. Otherwise, it
   * generates a valid HTML tag name from storyId by removing non-ASCII alphanumerics from storyId,
   * prefixing "sb-", and suffixing "-component"
   *
   * @memberof AbstractRenderer
   * @protected
   */
  protected generateTargetSelectorFromStoryId(id: string) {
    const invalidHtmlTag = /[^A-Za-z0-9-]/g;
    const storyIdIsInvalidHtmlTagName = invalidHtmlTag.test(id);
    return storyIdIsInvalidHtmlTagName ? `sb-${id.replace(invalidHtmlTag, '')}-component` : id;
  }

  /**
   * Angular is unable to handle components that have selectors with accented attributes.
   *
   * Therefore, stories break when meta's title contains accents.
   * https://github.com/storybookjs/storybook/issues/29132
   *
   * This method filters accents from a given raw id. For example, this method converts
   * 'Example/Button with an "é" accent' into 'Example/Button with an "e" accent'.
   *
   * @memberof AbstractRenderer
   * @protected
   */
  protected generateStoryUIdFromRawStoryUid(rawStoryUid: string | null) {
    if (rawStoryUid === null) {
      return rawStoryUid;
    }

    const accentCharacters = /[\u0300-\u036f]/g;
    return rawStoryUid.normalize('NFD').replace(accentCharacters, '');
  }

  /** Adds DOM element that angular will use as bootstrap component. */
  protected initAngularRootElement(targetDOMNode: HTMLElement, targetSelector: string) {
    targetDOMNode.innerHTML = '';
    targetDOMNode.appendChild(document.createElement(targetSelector));
  }

  private fullRendererRequired({
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
      moduleMetadataSnapshot: stringify(moduleMetadata, { maxDepth: 50 }),
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
