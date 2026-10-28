import { getInstanceContext } from '../../../instance-context.ts';

import type { StoryDocsProvider } from '@storybook/core/internal/types';

import type { Storybook } from '../../../../instance/types.ts';
import { getRefsFromConfig } from '../../../../common/utils/get-refs-from-config.ts';
import { getDevServerSubscriptions } from '../../../../services/dev-server-subscriptions.ts';
import { loadManifests } from '../../../../story-index/manifests/manifests.ts';
import { createLocalDocsAccess } from '../../toolsets/docs/access-local.ts';
import { sourceUrlManifestProvider } from '../../toolsets/docs/access-provider.ts';
import { createDocsToolset } from '../../toolsets/docs/definition.ts';
import { createCompositionDocsSources } from '../../toolsets/docs/multi-source.ts';
import { registerToolset } from '../../toolset-registry.ts';
import { registerStoryDocsService, subscribeStoryDocsToModuleGraphChanges } from './server.ts';

export default async function setup(
  storybook: Pick<Storybook, 'presets' | 'getIndex' | 'workingDir'>
): Promise<void> {
  const getIndex = () => storybook.getIndex();
  const instance = getInstanceContext()?.storybook;
  const features = instance
    ? await instance.callHook('core:features:extend', undefined)
    : await storybook.presets.apply('features');
  if (features?.docgenServer) {
    const storyDocsProvider = instance
      ? await instance.callHook('core:story-docs-provider:extend', async () => undefined)
      : await storybook.presets.apply<StoryDocsProvider>(
          'experimental_storyDocsProvider',
          async () => undefined
        );
    registerStoryDocsService({ getIndex, storyDocsProvider });
    getDevServerSubscriptions().push(() =>
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: storybook.workingDir })
    );
  }
  const localDocsAccess = createLocalDocsAccess({
    storyIndex: { getIndex },
    getManifests: () => loadManifests(storybook.presets),
  });
  const refs = await getRefsFromConfig(storybook);
  registerToolset(
    createDocsToolset(
      refs.length > 0
        ? {
            sources: createCompositionDocsSources({
              sources: [{ id: 'local', title: 'Local' }, ...refs],
              manifestProvider: sourceUrlManifestProvider,
              localAccess: localDocsAccess,
            }),
          }
        : { docsAccess: localDocsAccess }
    )
  );
}
