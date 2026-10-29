import '../../../../services/hooks.ts';

import type { Storybook } from '../../../../instance/types.ts';
import { getDevServerSubscriptions } from '../../../../services/dev-server-subscriptions.ts';
import { registerDocgenService, subscribeDocgenToModuleGraphChanges } from './server.ts';
import { createDocgenWorkerClient } from './worker/docgen-worker-client.ts';

export default async function setup(
  storybook: Pick<Storybook, 'callHook' | 'getIndex' | 'workingDir'>
): Promise<void> {
  const features = await storybook.callHook('core:features:extend', undefined);
  if (!features?.docgenServer) {
    return;
  }
  const descriptors = await storybook.callHook('core:docgen-providers:collect', []);
  const worker = descriptors.length > 0 ? createDocgenWorkerClient(descriptors) : undefined;
  if (!worker) {
    return;
  }
  const getIndex = () => storybook.getIndex();
  registerDocgenService({ getIndex, docgenProvider: (input) => worker.extract(input.entry) });
  getDevServerSubscriptions().push(() =>
    subscribeDocgenToModuleGraphChanges({ getIndex, workingDir: storybook.workingDir })
  );
}
