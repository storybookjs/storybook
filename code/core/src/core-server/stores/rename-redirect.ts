import { optionalEnvToBoolean } from '../../common/utils/envs.ts';
import {
  UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  type RenameRedirectState,
} from '../../shared/rename-redirect-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

export const renameRedirectStore = UniversalStore.create<RenameRedirectState>({
  ...UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  /*
    This mirrors the status store pattern: avoid creating the store as leader in
    the vitest sub-process in addon-vitest, where it would try to connect to the
    dev server leader before it is ready.
  */
  leader: !optionalEnvToBoolean(process.env.VITEST_CHILD_PROCESS),
});
