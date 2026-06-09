import type { ApplicationRef } from '@angular/core';

import type { MountApplicationOptions } from './AbstractRenderer.ts';
import { CanvasRenderer } from './CanvasRenderer.ts';
import { mountWithTestBed, resetTestBed } from './utils/TestBedMounting.ts';

/**
 * Canvas renderer that creates the story through Angular's TestBed
 * (`previewTestBedRenderer` feature flag) instead of bootstrapping a standalone application.
 *
 * Only the mounting strategy differs from CanvasRenderer: story preparation, the wrapper
 * component (input/output bindings, storyProps$ updates) and the rerender fast path are shared.
 *
 * The TestBed strategy is canvas-only: a docs page renders multiple stories with potentially
 * different application configs, which cannot share the single TestBed environment injector.
 */
export class TestBedRenderer extends CanvasRenderer {
  override async beforeFullRender(): Promise<void> {
    await super.beforeFullRender();
    // Reset before render() creates the story's wrapper and declarations module — see
    // resetTestBed() for why the order matters for the JIT module scoping queue.
    resetTestBed();
  }

  protected override async mountApplication(
    options: MountApplicationOptions
  ): Promise<ApplicationRef> {
    return mountWithTestBed(options);
  }
}
