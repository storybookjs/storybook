import { ApplicationRef } from '@angular/core';
import { TestComponentRenderer, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import type { MountApplicationOptions } from '../AbstractRenderer.ts';

/**
 * Places the fixture's root element inside the story's target DOM node instead of the default
 * detached `<div>` appended to `document.body`. The element created by `initAngularRootElement`
 * (which carries the story selector and optional story UID attribute) becomes the component's real
 * host element, so `:host` styles, host listeners and the selector machinery keep working.
 */
class StorybookTestComponentRenderer extends TestComponentRenderer {
  constructor(
    private targetDOMNode: HTMLElement,
    private componentSelector: string
  ) {
    super();
  }

  override insertRootElement(rootElId: string) {
    const hostElement = this.targetDOMNode.querySelector(this.componentSelector);
    if (hostElement) {
      hostElement.id = rootElId;
    }
  }

  override removeAllRootElements() {
    // initAngularRootElement clears the target node before every full render, and
    // TestBed.resetTestingModule() destroys the previous fixture. Nothing to clean up here.
  }
}

/**
 * Renders the story wrapper application with Angular's TestBed instead of bootstrapping a
 * standalone application per story.
 *
 * Uses the documented TestBed singleton lifecycle: the test environment is initialized once (or
 * reused when something else, e.g. a Vitest setup file, already initialized it), the testing
 * module is reset and reconfigured per story render, and `resetTestingModule()` takes care of
 * destroying the previous fixture including its `ngOnDestroy` lifecycle.
 */
export async function mountWithTestBed({
  application,
  providers,
  targetDOMNode,
  componentSelector,
}: MountApplicationOptions): Promise<ApplicationRef> {
  const testBed = getTestBed();

  if (!testBed.platform) {
    testBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
  }

  try {
    testBed.resetTestingModule();
  } catch {
    // The previous testing module may already have been torn down externally (e.g. through
    // ApplicationRef.destroy() in resetApplications). Reconfiguring below starts from scratch.
  }

  testBed.configureTestingModule({
    providers: [
      ...providers,
      {
        provide: TestComponentRenderer,
        useValue: new StorybookTestComponentRenderer(targetDOMNode, componentSelector),
      },
    ],
  });

  await testBed.compileComponents();

  const fixture = testBed.createComponent(application);
  // Attach the fixture to ApplicationRef so change detection keeps running after the initial
  // render — play functions and storyProps$ updates rely on it.
  fixture.autoDetectChanges();

  // provideRouter() relies on the application bootstrap to trigger the initial navigation, but
  // TestBed.createComponent never bootstraps. Kick the router off manually when one is provided.
  try {
    const { Router } = await import('@angular/router');
    testBed.inject(Router, null, { optional: true })?.initialNavigation();
  } catch {
    // @angular/router is an optional dependency.
  }

  await fixture.whenStable();

  return testBed.inject(ApplicationRef);
}
