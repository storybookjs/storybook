import type { Highlight } from './types.ts';
import { normalizeOptions } from './utils.ts';
import { isHighlightOptions } from './validation.ts';

/** Registry bucket for highlights announced by the host preview. */
const HOST_REGISTRY_KEY = '';
/** Registry bucket for manager-local registrations, which apply to every frame. */
const MANAGER_REGISTRY_KEY = Symbol('manager-registry');

type HighlightEventContext = {
  refId?: string;
  source?: string;
};

/**
 * Manager-side registry of the highlight definitions announced over the channel. The preview only
 * reports which highlight id was hit; the manager resolves the menu content from this registry, so
 * menu content is never rendered from the menu state event. Entries are bucketed by origin: every
 * ref has its own bucket keyed by its ref id, the host preview's registrations live in the host
 * bucket, and manager-local registrations (e.g. from manager addons) live in a bucket of their own,
 * so identical highlight ids never overwrite each other across origins.
 */
export class HighlightRegistry {
  private registry = new Map<string | symbol, Map<string, Highlight>>();

  private listeners = new Set<() => void>();

  private getRegistryKey({ refId, source }: HighlightEventContext): string | symbol {
    // Events from a preview carry the source its channel transport stamped on them; a ref's events
    // additionally carry its ref id. Manager-local emits carry neither.
    if (refId) {
      return refId;
    }
    return source ? HOST_REGISTRY_KEY : MANAGER_REGISTRY_KEY;
  }

  private getBucket(context: HighlightEventContext) {
    const key = this.getRegistryKey(context);
    let bucket = this.registry.get(key);
    if (!bucket) {
      bucket = new Map();
      this.registry.set(key, bucket);
    }
    return bucket;
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  add(context: HighlightEventContext, highlight: unknown) {
    if (!isHighlightOptions(highlight)) {
      return false;
    }

    const info = normalizeOptions(highlight);
    const bucket = this.getBucket(context);

    // A highlight without selectors removes any previous registration with the same id, matching
    // the preview's behavior.
    if (!info.selectors?.length) {
      const removed = bucket.delete(info.id);
      if (removed) {
        this.emit();
      }
      return removed;
    }

    bucket.set(info.id, info);
    this.emit();
    return true;
  }

  remove(context: HighlightEventContext, id: unknown) {
    if (typeof id !== 'string' || !id) {
      return false;
    }

    const removed = this.registry.get(this.getRegistryKey(context))?.delete(id) ?? false;
    if (removed) {
      this.emit();
    }
    return removed;
  }

  reset(context: HighlightEventContext) {
    const key = this.getRegistryKey(context);
    if (key === MANAGER_REGISTRY_KEY) {
      // Every preview listens for a manager-local reset and resets itself, so it clears all frames.
      this.registry.clear();
    } else {
      // A preview's reset only clears its own entries.
      this.registry.delete(key);
    }
    this.emit();
  }

  clearFrame(refId?: string) {
    this.registry.delete(refId ?? HOST_REGISTRY_KEY);
    this.emit();
  }

  find(id: string, frameId?: string) {
    return (
      (frameId
        ? this.registry.get(frameId)?.get(id)
        : this.registry.get(HOST_REGISTRY_KEY)?.get(id)) ??
      this.registry.get(MANAGER_REGISTRY_KEY)?.get(id)
    );
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
