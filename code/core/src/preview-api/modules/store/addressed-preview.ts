import type { Args, Globals, StoryId } from 'storybook/internal/types';

export const MANAGER_DOCS_INSTANCE_PARAM = 'managerDocsInstance';

export type AddressedArgsStore = {
  replace(storyId: StoryId, args: Args): void;
  get(storyId: StoryId): Args;
  resetToInitial(storyId: StoryId): void;
};

export type AddressedGlobalsStore = {
  replace(globals: Globals): void;
  get(): Globals;
  resetToInitial(): void;
};

export type AddressedPreview = {
  instanceId: string | null;
  generation: number;
  storyId: StoryId;
  args: AddressedArgsStore;
  globals: AddressedGlobalsStore;
};

export type AddressedUpdate = {
  kind: 'args' | 'globals';
  instanceId?: string;
  storyId?: StoryId;
  args?: Args;
  globals?: Globals;
  generation?: number;
};

export function managerDocsInstanceFromSearch(search: string | null | undefined): string | null {
  return queryParam(search, MANAGER_DOCS_INSTANCE_PARAM);
}

export function storyIdFromSearch(search: string | null | undefined): string | null {
  return queryParam(search, 'id');
}

// No instance id is the story-id broadcast, which only the main canvas applies.
export function acceptsAddressedUpdate(
  documentInstanceId: string | null,
  eventInstanceId: string | undefined
): boolean {
  if (eventInstanceId) {
    return documentInstanceId === eventInstanceId;
  }
  return documentInstanceId === null;
}

export function createAddressedPreview(input: {
  instanceId: string | null;
  storyId: StoryId;
  args: AddressedArgsStore;
  globals: AddressedGlobalsStore;
}): AddressedPreview {
  return { ...input, generation: 1 };
}

export function applyAddressedUpdate(doc: AddressedPreview, event: AddressedUpdate): boolean {
  if (!acceptsAddressedUpdate(doc.instanceId, event.instanceId) || !event.instanceId) {
    return false;
  }
  if (event.generation !== undefined && event.generation !== doc.generation) {
    return false;
  }
  if (event.kind === 'args') {
    if (!event.storyId || event.storyId !== doc.storyId) {
      return false;
    }
    doc.args.replace(doc.storyId, event.args ?? {});
    return true;
  }
  doc.globals.replace(event.globals ?? {});
  return true;
}

export function resetAddressedPreview(doc: AddressedPreview): void {
  doc.args.resetToInitial(doc.storyId);
  doc.globals.resetToInitial();
  doc.generation += 1;
  doc.instanceId = null;
}

export function reuseAddressedPreview(
  doc: AddressedPreview,
  next: { instanceId: string; storyId: StoryId; args: Args; globals: Globals }
): void {
  doc.args.resetToInitial(doc.storyId);
  doc.globals.resetToInitial();
  doc.instanceId = next.instanceId;
  doc.storyId = next.storyId;
  doc.generation += 1;
  doc.args.replace(next.storyId, next.args);
  doc.globals.replace(next.globals);
}

function queryParam(search: string | null | undefined, name: string): string | null {
  if (!search) {
    return null;
  }
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(name) || null;
}
