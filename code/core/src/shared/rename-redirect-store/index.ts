import type { Path, StoryId } from '../../types/index.ts';
import type { StoreOptions } from '../universal-store/types.ts';

export type RenameRedirectChain = (StoryId | null)[];

export type RenameRedirectState = {
  chains: Record<StoryId, RenameRedirectChain>;
  origins: Record<StoryId, Path>;
};

export const INITIAL_RENAME_REDIRECT_STATE: RenameRedirectState = {
  chains: {},
  origins: {},
};

export const UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS: StoreOptions<RenameRedirectState> = {
  id: 'storybook/rename-redirect',
  initialState: INITIAL_RENAME_REDIRECT_STATE,
};

export type Rename = { oldId: StoryId; newId: StoryId; origin: Path };
export type Orphan = { id: StoryId; origin: Path };
export type Deletion = { id: StoryId; origin: Path };

export type RenameEvents = {
  renames: Rename[];
  orphans: Orphan[];
  deletions: Deletion[];
};

export function extendRenameMaps(
  current: RenameRedirectState,
  events: RenameEvents
): RenameRedirectState {
  const chains = { ...current.chains };
  const origins = { ...current.origins };

  for (const { oldId, newId } of events.renames) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === oldId) {
        chains[source] = [...chain, newId];
      }
    }
    chains[oldId] = [...(chains[oldId] ?? []), newId];
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === source) {
        delete chains[source];
      }
    }
  }

  for (const { id: deletedId } of events.deletions) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === deletedId) {
        chains[source] = [...chain, null];
      }
    }
    chains[deletedId] = [...(chains[deletedId] ?? []), null];
  }

  return { chains, origins };
}
