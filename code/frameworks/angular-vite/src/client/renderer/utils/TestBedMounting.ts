import type { ComponentRef, Provider, ProviderToken, Type } from '@angular/core';
import {
  ApplicationInitStatus,
  ApplicationRef,
  ChangeDetectorRef,
  EnvironmentInjector,
  Injector,
  NgZone,
  createComponent,
  destroyPlatform,
  getPlatform,
  inject,
  inputBinding,
  outputBinding,
  reflectComponentType,
  signal,
  ɵflushModuleScopingQueueAsMuchAsPossible as flushModuleScopingQueue,
  ɵgetComponentDef as getComponentDef,
} from '@angular/core';
import type { TestBed } from '@angular/core/testing';
import { ComponentFixture, getTestBed } from '@angular/core/testing';
import { BrowserModule } from '@angular/platform-browser';
import { platformBrowserTesting } from '@angular/platform-browser/testing';
import { skip } from 'rxjs/operators';

import { buildTemplate } from '../../../template-grammar.ts';
import type { ICollection, StoryFnAngularReturnType } from '../../types.ts';
import type { StoryMountOptions } from '../AbstractRenderer.ts';
import { computesTemplateFromComponent } from '../ComputesTemplateFromComponent.ts';
import { getApplication } from '../StorybookModule.ts';
import { STORY_PROPS } from '../StorybookProvider.ts';
import { getComponentInputsOutputs } from './NgComponentAnalyzer.ts';

// Must run before the next story's wrapper component and declarations module are created:
// resetTestingModule() also clears Angular's JIT module scoping queue, and the freshly decorated
// module has to still be in that queue when the wrapper compiles so its declared components get
// their transitive scope.
export function resetTestBed() {
  const testBed = getTestBed();

  if (!testBed.platform) {
    return;
  }

  try {
    // A story file evaluated for this render may have queued its own NgModules for scoping;
    // resetTestingModule() would drop them, and their components would never see CommonModule.
    flushModuleScopingQueue();
    testBed.resetTestingModule();
  } catch {
    // The previous fixture may already have been torn down through ApplicationRef.destroy().
  }
}

export async function mountWithTestBed(options: StoryMountOptions): Promise<ApplicationRef> {
  const testBed = getTestBed();
  const {
    storyFnAngular,
    component,
    analyzedMetadata,
    providers,
    targetDOMNode,
    componentSelector,
  } = options;

  if (!testBed.platform) {
    // A docs page rendered earlier bootstrapped a browser platform. TestBed cannot adopt it, and
    // its applications were already destroyed when the render type switched to canvas.
    if (getPlatform()) {
      destroyPlatform();
    }
    // BrowserModule rather than BrowserTestingModule: the latter swaps PlatformLocation for a fake
    // navigation, and a story's router has to see the preview's real URL, like bootstrapApplication.
    testBed.initTestEnvironment(BrowserModule, platformBrowserTesting());
  }

  const storyRoot = targetDOMNode.querySelector(componentSelector);
  if (!storyRoot) {
    throw new Error(`Storybook could not find the story root element "${componentSelector}"`);
  }

  const rootComponent =
    component !== undefined && rendersComponentOnly(storyFnAngular, component)
      ? component
      : getApplication({
          storyFnAngular,
          component,
          targetSelector: componentSelector,
          analyzedMetadata,
        });

  if (rootComponent === component) {
    testBed.configureTestingModule({
      imports: analyzedMetadata.imports,
      declarations: analyzedMetadata.declarations,
      schemas: storyFnAngular.moduleMetadata?.schemas,
      providers,
    });
  } else {
    testBed.configureTestingModule({ providers });
  }

  await testBed.compileComponents();
  // bootstrapApplication awaits the app initializers before creating the root component.
  await testBed.inject(ApplicationInitStatus).donePromise;

  if (component) {
    deferShadowedProvidersToStory(
      component,
      analyzedMetadata.providers,
      testBed.inject(ApplicationRef)
    );
  }

  const environmentInjector = testBed.inject(EnvironmentInjector);
  if (rootComponent === component) {
    mountStoryComponent(testBed, component, storyFnAngular.props ?? {}, {
      hostElement: createHostElement(component, storyRoot),
      environmentInjector,
      // The same injector the wrapper component gives a story: right above the component.
      elementInjector: Injector.create({
        providers: analyzedMetadata.providers,
        parent: environmentInjector,
      }),
    });
  } else {
    createFixture(testBed, () =>
      createComponent(rootComponent, { environmentInjector, hostElement: storyRoot })
    );
  }

  // TestBed never bootstraps, so provideRouter()'s bootstrap listener never navigates. Router is
  // providedIn root, so only a story that provided routes gets one.
  try {
    const { ROUTES, Router } = await import('@angular/router');
    if (testBed.inject(ROUTES, null, { optional: true })) {
      testBed.inject(Router).initialNavigation();
    }
  } catch {
    // @angular/router is an optional peer dependency.
  }

  return testBed.inject(ApplicationRef);
}

// decorateStory generates the component template before any decorator runs, so a plain component
// story reaches the renderer with exactly the template the wrapper would build. A story whose
// template differs (a user template, componentWrapperDecorator) or that has styles needs the wrapper.
function rendersComponentOnly(
  { template, userDefinedTemplate, props, styles }: StoryFnAngularReturnType,
  component: Type<unknown>
) {
  if (styles?.length || userDefinedTemplate) {
    return false;
  }
  return template == null || template === computesTemplateFromComponent(component, props, '');
}

// The story component is the fixture root. Its inputs and outputs are bound the way the wrapper's
// generated template bound them, and every other prop is assigned to the instance.
function mountStoryComponent(
  testBed: TestBed,
  component: Type<unknown>,
  initialProps: ICollection,
  options: Parameters<typeof createComponent>[1]
) {
  const props = signal(initialProps);
  const { inputs, outputs } = getComponentInputsOutputs(component);
  const bound = (names: { templateName: string }[]) =>
    names.filter(({ templateName }) => templateName in initialProps).map((io) => io.templateName);
  const bindings = [
    ...bound(inputs).map((name) => inputBinding(name, () => props()[name])),
    ...bound(outputs).map((name) => outputBinding(name, (event) => props()[name](event))),
  ];
  const ioNames = new Set([...inputs, ...outputs].map(({ templateName }) => templateName));
  const assignOtherProps = (instance: unknown, next: ICollection) => {
    for (const [key, value] of Object.entries(next)) {
      if (!ioNames.has(key)) {
        Object.assign(instance as object, { [key]: value });
      }
    }
  };

  const fixture = createFixture(testBed, () => {
    const componentRef = createComponent(component, { ...options, bindings });
    assignOtherProps(componentRef.instance, initialProps);
    return componentRef;
  });

  const subscription = testBed
    .inject(STORY_PROPS)
    .pipe(skip(1))
    .subscribe((next = {}) => {
      props.set(next);
      assignOtherProps(fixture.componentInstance, next);
      fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges();
    });
  fixture.componentRef.onDestroy(() => subscription.unsubscribe());
}

function createFixture<T>(testBed: TestBed, create: () => ComponentRef<T>) {
  const fixture = testBed
    .inject(NgZone)
    .run(() => testBed.runInInjectionContext(() => new ComponentFixture(create())));
  testBed.inject(ApplicationRef).onDestroy(() => fixture.destroy());
  // Runs the first change detection synchronously and keeps it running afterwards for play
  // functions and story props. Like bootstrapApplication, the mount does not wait for the
  // application to become stable: a story may legitimately hold a pending task forever.
  fixture.autoDetectChanges();
  return fixture;
}

function createHostElement(component: Type<unknown>, storyRoot: Element) {
  const selector = reflectComponentType(component)?.selector ?? 'ng-component';
  const template = storyRoot.ownerDocument.createElement('template');
  template.innerHTML = buildTemplate(selector, { inputs: [], outputs: [] });
  const hostElement = template.content.firstElementChild;
  if (!hostElement) {
    throw new Error(`Storybook could not create a host element for the selector "${selector}"`);
  }
  storyRoot.appendChild(hostElement);
  return hostElement;
}

const providerTokens = (providers: Provider[] = []): unknown[] =>
  providers
    .flat(Infinity)
    .map((provider) => (typeof provider === 'function' ? provider : provider?.provide))
    .filter((token) => token !== undefined);

// moduleMetadata.providers live in the injector right above the story component. A token the
// component also provides for itself would shadow the story's provider, so that registration is
// sent one level up instead. https://github.com/storybookjs/storybook/issues/22352
// The component's compiled definition is patched rather than recompiled through
// TestBed.overrideComponent(): a production build defines ɵfac non-configurable, so a second
// recompile of the same component throws.
function deferShadowedProvidersToStory(
  component: Type<unknown>,
  storyProviders: Provider[],
  applicationRef: ApplicationRef
) {
  const storyTokens = new Set(providerTokens(storyProviders));
  const definition = getComponentDef(component);
  const resolveProviders = definition?.providersResolver;
  if (storyTokens.size === 0 || !definition || !resolveProviders) {
    return;
  }

  definition.providersResolver = (def, processProvidersFn) =>
    resolveProviders(def, (ownProviders) => {
      const own = processProvidersFn ? processProvidersFn(ownProviders) : ownProviders;
      const toStory = [...new Set(providerTokens(own))]
        .filter((token) => storyTokens.has(token))
        .map((token) => ({
          provide: token,
          useFactory: () => inject(token as ProviderToken<unknown>, { skipSelf: true }),
        }));
      return [...own, ...toStory];
    });
  applicationRef.onDestroy(() => {
    definition.providersResolver = resolveProviders;
  });
}
