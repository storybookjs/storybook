import { optionalEnvToBoolean } from '../../common/utils/envs.ts';
import { createStatusStore } from '../../shared/status-store/index.ts';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

const statusStore = createStatusStore({
  universalStatusStore: UniversalStore.create({
    ...UNIVERSAL_STATUS_STORE_OPTIONS,
    /*
      This is a temporary workaround, to ensure that the store is not created in the
      vitest sub-process in addon-vitest, even though it imports from core-server
      If it was created in the sub-process, it would try to connect to the leader in the dev server
      before it was ready.
      This will be fixed when we do the planned UniversalStore v0.2.

      STORYBOOK_ATTACHED_TOOLS is set by createTools in attached mode (and by the CLI dispatcher
      for `tools --attach`), because that process loads this module before it can prepare a
      follower channel.
    */
    leader:
      !optionalEnvToBoolean(process.env.VITEST_CHILD_PROCESS) &&
      !optionalEnvToBoolean(process.env.STORYBOOK_ATTACHED_TOOLS) &&
      UniversalStore.preparedEnvironment !== UniversalStore.Environment.UNKNOWN,
  }),
  environment: 'server',
});

export const { fullStatusStore, getStatusStoreByTypeId, universalStatusStore } = statusStore;
