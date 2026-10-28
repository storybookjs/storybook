import { getInstanceContext } from '../../../instance-context.ts';

import type { DocgenProviderDescriptor } from '@storybook/core/internal/types';

import type { Storybook } from '../../../../instance/types.ts';
import { getDevServerSubscriptions } from '../../../../services/dev-server-subscriptions.ts';
import { registerDocgenService, subscribeDocgenToModuleGraphChanges } from './server.ts';
import { createDocgenWorkerClient } from './worker/docgen-worker-client.ts';

export default async function setup(
  storybook: Pick<Storybook, 'presets' | 'getIndex' | 'workingDir'>
): Promise<void> {
  const instance = getInstanceContext()?.storybook;
  const features = instance
    ? await instance.callHook('core:features:extend', undefined)
    : await storybook.presets.apply('features');
  if (!features?.docgenServer) {
    return;
  }
  const descriptors = instance
    ? await instance.callHook('core:docgen-providers:collect', [])
    : await storybook.presets.apply<DocgenProviderDescriptor[]>('experimental_docgenProvider', []);
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
