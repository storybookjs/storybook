import type { ComponentMeta } from 'vue-component-meta';

/**
 * Renders a Vue component's API surface as a neutral markdown fragment.
 *
 * Vue components expose four structurally distinct member kinds — props, slots, events, and exposed —
 * which `vue-component-meta` (Volar) returns as separate arrays on the {@link ComponentMeta}. Each is
 * rendered under its own `## ` section as a fenced `ts` block declaring an `export type` (`Props`,
 * `Slots`, `Events`, `Exposed`). This TypeScript-type-like syntax is easier for AI/agents to consume
 * than a markdown table and matches the shape the React producer already emits (`export type Props =
 * { ... }`). Because each kind is a separate array, a slot can never leak into the `Props` block.
 *
 * Types come from Volar's resolved `type` strings (e.g. `'sm' | 'md' | 'lg'` rather than a flat
 * `union`), which is the whole reason this renderer reads `ComponentMeta` instead of the shallower
 * `vue-docgen-api` `ComponentDoc`. Inside a fenced code block the union `|` needs no escaping.
 *
 * This renders ONLY the API fragment: no component header, description, or stories. Those belong to
 * the consumer's envelope (the MCP server), which inserts this fragment verbatim and never parses it.
 *
 * Kept pure (no file IO, no checker runtime) so it is trivially unit-testable against a hand-built
 * `ComponentMeta`.
 */
const oneLine = (value: string | undefined): string => (value ?? '').replace(/\r?\n/g, ' ').trim();

interface TypeMember {
  name: string;
  type: string;
  /** Renders the member with a trailing `?` (optional prop). */
  optional?: boolean;
  /** Rendered as ` = <default>` after the type, when present. */
  default?: string;
  description?: string;
}

export function renderVueapiMd(meta: ComponentMeta): string {
  const parts: string[] = [];

  parts.push(...formatPropsSection(meta));
  parts.push(...formatSlotsSection(meta));
  parts.push(...formatEventsSection(meta));
  parts.push(...formatExposedSection(meta));

  return parts.join('\n').trim();
}

/** Renders one `## <title>` section as a fenced `ts` block declaring `export type <typeName>`. */
function typeBlock(title: string, typeName: string, members: TypeMember[]): string[] {
  if (members.length === 0) {
    return [];
  }

  const parts: string[] = [title, '', '```ts', `export type ${typeName} = {`];

  for (const member of members) {
    const description = oneLine(member.description);
    if (description) {
      parts.push(`  /** ${description} */`);
    }

    let line = `  ${member.name}`;
    if (member.optional) {
      line += '?';
    }
    line += `: ${oneLine(member.type) || 'unknown'}`;

    const defaultValue = oneLine(member.default);
    if (defaultValue) {
      line += ` = ${defaultValue}`;
    }

    line += ';';
    parts.push(line);
  }

  parts.push('}', '```', '');
  return parts;
}

function formatPropsSection(meta: ComponentMeta): string[] {
  // Skip global props (inherited HTML/attribute props); they are noise and would swamp the block.
  const members = (meta.props ?? [])
    .filter((prop) => !prop.global)
    .map((prop) => ({
      name: prop.name,
      type: prop.type,
      optional: !prop.required,
      default: prop.default,
      description: prop.description,
    }));
  return typeBlock('## Props', 'Props', members);
}

function formatSlotsSection(meta: ComponentMeta): string[] {
  // For component-meta the slot's scoped bindings are its resolved `type` string
  // (e.g. `{ text: string; year: number }`).
  const members = (meta.slots ?? []).map((slot) => ({
    name: slot.name,
    type: slot.type,
    description: slot.description,
  }));
  return typeBlock('## Slots', 'Slots', members);
}

function formatEventsSection(meta: ComponentMeta): string[] {
  const members = (meta.events ?? []).map((event) => ({
    name: event.name,
    type: event.type,
    description: event.description,
  }));
  return typeBlock('## Events', 'Events', members);
}

function formatExposedSection(meta: ComponentMeta): string[] {
  const members = (meta.exposed ?? []).map((expose) => ({
    name: expose.name,
    type: expose.type,
    description: expose.description,
  }));
  return typeBlock('## Exposed', 'Exposed', members);
}
