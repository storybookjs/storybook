import { ApplicationRef, destroyPlatform, getPlatform } from '@angular/core';
import { TestComponentRenderer, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import type { MountApplicationOptions } from '../AbstractRenderer.ts';

// TestBed would otherwise append a detached <div> to document.body. Reusing the element created by
// initAngularRootElement keeps the story selector, the story UID attribute, `:host` styles and host
// listeners on the real host element.
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

  // initAngularRootElement clears the target node before every full render and
  // resetTestingModule() destroys the previous fixture.
  override removeAllRootElements() {}
}

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
    testBed.resetTestingModule();
  } catch {
    // The previous fixture may already have been torn down through ApplicationRef.destroy().
  }
}

export async function mountWithTestBed({
  application,
  providers,
  targetDOMNode,
  componentSelector,
}: MountApplicationOptions): Promise<ApplicationRef> {
  const testBed = getTestBed();

  if (!testBed.platform) {
    // A docs page rendered earlier bootstrapped a browser platform. TestBed cannot adopt it, and
    // its applications were already destroyed when the render type switched to canvas.
    if (getPlatform()) {
      destroyPlatform();
    }
    testBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
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

  // Runs the first change detection synchronously and keeps it running afterwards for play
  // functions and storyProps$. Like bootstrapApplication, the mount does not wait for the
  // application to become stable: a story may legitimately hold a pending task forever.
  testBed.createComponent(application).autoDetectChanges();

  // TestBed never bootstraps, so provideRouter()'s bootstrap listener never navigates.
  try {
    const { Router } = await import('@angular/router');
    testBed.inject(Router, null, { optional: true })?.initialNavigation();
  } catch {
    // @angular/router is an optional peer dependency.
  }

  return testBed.inject(ApplicationRef);
}
