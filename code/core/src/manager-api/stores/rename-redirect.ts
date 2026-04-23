import {
  UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  type RenameRedirectState,
} from '../../shared/rename-redirect-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

export const renameRedirectStore = UniversalStore.create<RenameRedirectState>({
  ...UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  /*
    In a live dev server, the manager is a follower (server is leader).
    In a static build, CONFIG_TYPE === 'PRODUCTION' and the store is inert:
    no renames are ever detected, state stays empty, and the redirect/deletion
    logic in setIndex and the 404 path becomes a no-op.
  */
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});
