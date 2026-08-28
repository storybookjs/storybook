/** Temporary `vue-docgen-api` merges filling gaps Volar leaves in the extracted component meta. */
import { readFile } from 'node:fs/promises';

import type { ComponentMeta, EventMeta, SlotMeta } from 'vue-component-meta';
import { parseMulti, type ComponentDoc } from 'vue-docgen-api';

/**
 * Fills the gaps Volar cannot extract yet from a `vue-docgen-api` parse of the same file:
 *
 * - Event descriptions: https://github.com/vuejs/language-tools/issues/3893
 * - Runtime-declared emits that Volar drops or leaks as handler props
 * - Template-declared slots: Volar only infers slots for `<script setup>` components, so an
 *   Options API component loses every template slot, and `@slot` comment descriptions are never
 *   read for anyone
 *
 * Performance note: `parseMulti` takes a few milliseconds (8-20ms) and only runs when a gap is
 * actually present in the extracted meta. Delete each merge once Volar covers it, and uninstall
 * the vue-docgen-api dependency when both are gone.
 */
export async function applyVueDocgenApiTempFixes(
  filename: string,
  componentsMeta: ComponentMeta[],
  exportNames: string[]
): Promise<ComponentMeta[]> {
  const source = await readVueDocgenApiFallbackSource(filename);
  const hasEvents = componentsMeta.some((meta) => meta.events.length > 0);
  const needsEventRestore = hasRuntimeEmitsDeclaration(source);
  const needsSlots = hasTemplateSlotGap(filename, componentsMeta, source);

  if (!hasEvents && !needsEventRestore && !needsSlots) {
    return componentsMeta;
  }

  try {
    const parsedComponentDocs = await parseMulti(filename);

    // vue-docgen-api reorders its docs (default export first), so positional pairing would attach
    // another export's events to this meta in multi-export files.
    const parsedByExportName = new Map(parsedComponentDocs.map((doc) => [doc.exportName, doc]));

    componentsMeta.forEach((meta, index) => {
      const parsed = parsedByExportName.get(exportNames[index]!);
      if (!parsed) {
        return;
      }
      if (hasEvents || needsEventRestore) {
        mergeEventDescriptions(meta, parsed.events);
      }
      if (needsEventRestore) {
        restoreMissingRuntimeEvents(meta, parsed.events);
      }
      if (needsSlots) {
        mergeTemplateSlots(meta, parsed.slots);
      }
    });
  } catch {
    // noop
  }

  return componentsMeta;
}

async function readVueDocgenApiFallbackSource(filename: string): Promise<string | undefined> {
  if (!/\.(?:vue|tsx?|jsx?)$/.test(filename)) {
    return undefined;
  }

  try {
    return await readFile(filename, 'utf-8');
  } catch {
    return undefined;
  }
}

function hasRuntimeEmitsDeclaration(source: string | undefined): boolean {
  if (!source) {
    return false;
  }

  return /defineEmits\s*\(\s*[\[{]/.test(source) || /\bemits\s*:/.test(source);
}

function mergeEventDescriptions(meta: ComponentMeta, events: ComponentDoc['events']): void {
  if (!meta.events.length || !events?.length) {
    return;
  }

  for (const event of meta.events) {
    const description = events.find((i) => i.name === event.name)?.description;
    if (description) {
      (event as typeof event & { description: string }).description = description;
    }
  }
}

function restoreMissingRuntimeEvents(meta: ComponentMeta, events: ComponentDoc['events']): void {
  for (const event of events ?? []) {
    if (meta.events.some((candidate) => candidate.name === event.name)) {
      continue;
    }

    meta.events.push({
      name: event.name,
      description: event.description ?? '',
      tags: [],
      type: 'any[]',
      signature: `(event: "${event.name}", ...args: any[]): void`,
      schema: ['any'],
      declarations: [],
    } as unknown as EventMeta);
    removeLeakedEventHandlerProp(meta, event.name);
  }
}

/**
 * A declared emit and its `onX` handler prop are one contract in Vue, so once the event is
 * restored the handler prop is a duplicate — whether Volar synthesized it or the author spelled
 * it out.
 */
function removeLeakedEventHandlerProp(meta: ComponentMeta, eventName: string): void {
  const propName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;

  for (let index = meta.props.length - 1; index >= 0; index -= 1) {
    if (meta.props[index]?.name === propName) {
      meta.props.splice(index, 1);
    }
  }
}

/**
 * Whether the SFC template declares slots that the extracted meta misses, entirely or by
 * description. Reading the source keeps `parseMulti` away from the common slot-less component.
 */
function hasTemplateSlotGap(
  filename: string,
  componentsMeta: ComponentMeta[],
  source: string | undefined
): boolean {
  if (!filename.endsWith('.vue')) {
    return false;
  }

  const hasGap = componentsMeta.some(
    (meta) => meta.slots.length === 0 || meta.slots.some((slot) => !slot.description)
  );
  if (!hasGap) {
    return false;
  }

  return /<slot[\s/>]/.test(source ?? '');
}

/** Merges template-derived slots into the meta: descriptions onto known slots, missing slots whole. */
function mergeTemplateSlots(meta: ComponentMeta, slots: ComponentDoc['slots']): void {
  for (const slot of slots ?? []) {
    const existing = meta.slots.find((candidate) => candidate.name === slot.name);
    if (existing) {
      if (!existing.description && slot.description) {
        existing.description = slot.description;
      }
      continue;
    }

    const bindings = (slot.bindings ?? [])
      .filter((binding) => binding.name)
      .map((binding) => `${binding.name}: ${binding.type?.name ?? 'unknown'}`);
    const type = bindings.length > 0 ? `{ ${bindings.join('; ')} }` : '{}';
    meta.slots.push({
      name: slot.name,
      description: slot.description ?? '',
      type,
      schema: type,
      tags: [],
    } as unknown as SlotMeta);
  }
}
