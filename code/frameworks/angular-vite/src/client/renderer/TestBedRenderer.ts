import type { ApplicationRef } from '@angular/core';

import type { MountApplicationOptions } from './AbstractRenderer.ts';
import { CanvasRenderer } from './CanvasRenderer.ts';
import { queueBootstrapping } from './utils/BootstrapQueue.ts';
import { mountWithTestBed, resetTestBed } from './utils/TestBedMounting.ts';

// Only the mounting differs from CanvasRenderer: story preparation, the wrapper component and the
// rerender fast path are shared.
export class TestBedRenderer extends CanvasRenderer {
  private lastRender: Promise<unknown> = Promise.resolve();

  // A render that starts while another is still mounting (a hot update during a story load)
  // would reset the TestBed module the first one is configuring. One TestBed, one render at a time.
  public override render(options: Parameters<CanvasRenderer['render']>[0]): Promise<void> {
    const render = this.lastRender.then(() => super.render(options));
    this.lastRender = render.catch(() => {});
    return render;
  }

  override async beforeFullRender(): Promise<void> {
    await super.beforeFullRender();
    resetTestBed();
  }

  protected override async mountApplication(
    options: MountApplicationOptions
  ): Promise<ApplicationRef> {
    // The queue also resets Angular's compiled-component ids after the mount, so a hot update
    // can redefine a component without an NG0912 collision.
    return queueBootstrapping(() => mountWithTestBed(options));
  }
}
