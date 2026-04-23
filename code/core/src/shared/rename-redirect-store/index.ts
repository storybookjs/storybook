import type { StoryId } from '../../types/index.ts';
import type { StoreOptions } from '../universal-store/types.ts';

export type RenameRedirectChain = (StoryId | null)[];

export type RenameRedirectState = {
  chains: Record<StoryId, RenameRedirectChain>;
};

export const INITIAL_RENAME_REDIRECT_STATE: RenameRedirectState = { chains: {} };

export const UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS: StoreOptions<RenameRedirectState> = {
  id: 'storybook/rename-redirect',
  initialState: INITIAL_RENAME_REDIRECT_STATE,
};

export type Rename = { oldId: StoryId; newId: StoryId };

export function applyRenameChains(
  current: RenameRedirectState,
  renames: Rename[],
  deletions: StoryId[]
): RenameRedirectState {
  const chains = { ...current.chains };
  for (const { oldId, newId } of renames) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === oldId) {
        chains[source] = [...chain, newId];
      }
    }
    chains[oldId] = [...(chains[oldId] ?? []), newId];
  }
  return { chains };
}
