import type { ApplicationRef } from '@angular/core';

import type { MountApplicationOptions } from './AbstractRenderer.ts';
import { CanvasRenderer } from './CanvasRenderer.ts';
import { mountWithTestBed, resetTestBed } from './utils/TestBedMounting.ts';

// Only the mounting differs from CanvasRenderer: story preparation, the wrapper component and the
// rerender fast path are shared.
export class TestBedRenderer extends CanvasRenderer {
  override async beforeFullRender(): Promise<void> {
    await super.beforeFullRender();
    resetTestBed();
  }

  protected override async mountApplication(
    options: MountApplicationOptions
  ): Promise<ApplicationRef> {
    return mountWithTestBed(options);
  }
}
