import '../hooks.ts';

import { CHANGE_DETECTION_STATUS_TYPE_ID } from '@storybook/core/internal/types';

import { defineAddon } from '../../instance/addons.ts';
import type { Storybook } from '../../instance/types.ts';
import { bindToInstance } from '../../shared/instance-context.ts';
import { getStatusStoreByTypeId } from '../stores/status.ts';
import { ChangeDetectionService } from './change-detection-service.ts';
import { setChangeDetectionHost } from './readiness.ts';

/**
 * Publish change-detection statuses: the dev server starts them once its builder is ready, other
 * local instances on the first readiness request.
 */
export default defineAddon(() => ({
  meta: { name: 'storybook/change-detection' },
  setup(storybook): void {
    if (storybook.mode === 'build' || storybook.attached) {
      return;
    }
    let service: ChangeDetectionService | undefined;
    storybook.hook('core:instance:ready', () => {
      if (storybook.mode === 'dev') {
        // Created before the builder starts so early readiness requests wait for this service.
        service = createService(storybook);
        return;
      }
      setChangeDetectionHost(
        bindToInstance(() => {
          service ??= createService(storybook);
          service.start();
        })
      );
    });
    storybook.hook('core:preview-builder:ready', () => service?.start());
    storybook.hook('core:instance:close', () => service?.dispose().catch(() => undefined));
  },
}));

function createService(
  storybook: Pick<Storybook, 'getStoryIndexGenerator' | 'workingDir'>
): ChangeDetectionService {
  const storyIndexGeneratorPromise = storybook.getStoryIndexGenerator();
  // The service awaits it only once started; until then a failing index must not reject unhandled.
  storyIndexGeneratorPromise.catch(() => {});
  return new ChangeDetectionService({
    storyIndexGeneratorPromise,
    statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
    workingDir: storybook.workingDir,
  });
}
