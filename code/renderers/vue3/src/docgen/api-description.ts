import { indent } from '../story-docs/render-primitives.ts';
import type { MetaSource } from './component-meta.ts';

/** The slice of a component's normalized `vue-component-meta` output the api description reads. */
export type ApiDescriptionSource = Pick<
  MetaSource,
  'displayName' | 'typeParams' | 'props' | 'events' | 'slots' | 'exposed'
>;

type PropMeta = ApiDescriptionSource['props'][number];
type DocMember = Pick<PropMeta, 'description' | 'tags'>;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function buildApiDescription(meta: ApiDescriptionSource): string | undefined {
  const { slots, exposed } = meta;
  const bindableProps = meta.props.filter((prop) => !prop.global);
  const eventsByName = new Map(meta.events.map((event) => [event.name, event]));

  const models = bindableProps.filter((prop) => eventsByName.has(`update:${prop.name}`));
  const modelNames = new Set(models.map((model) => model.name));
  const props = bindableProps.filter((prop) => !modelNames.has(prop.name));
  const events = meta.events.filter(
    (event) =>
      !(event.name.startsWith('update:') && modelNames.has(event.name.slice('update:'.length - 1)))
  );

  if (!models.length && !props.length && !events.length && !slots.length && !exposed.length) {
    return undefined;
  }

  const sanitizedDisplayName = meta.displayName.replace(/\W+/g, '');
  const typePrefix = /^[A-Za-z_$]/.test(sanitizedDisplayName)
    ? sanitizedDisplayName
    : `Component${sanitizedDisplayName}`;

  function memberKey(name: string): string {
    return IDENTIFIER.test(name) ? name : JSON.stringify(name);
  }
  const parts: string[] = [];

  if (models.length > 0) {
    parts.push(
      ...section(
        'Models',
        `${typePrefix}Models`,
        meta.typeParams,
        models.flatMap((model) => {
          const event = eventsByName.get(`update:${model.name}`);
          const description = model.description?.trim() ? model.description : event?.description;
          return propLine(
            { ...model, description: description ?? '' },
            ` // ${modelBinding(model.name)}="..."`
          );
        }),
        'Two-way bindings. Bind each one with the `v-model` syntax shown next to it — do not pass the prop and listen to its `update:` event separately.'
      )
    );
  }

  if (props.length > 0) {
    parts.push(
      ...section(
        'Props',
        `${typePrefix}Props`,
        meta.typeParams,
        props.flatMap((prop) => propLine(prop))
      )
    );
  }

  if (events.length > 0) {
    parts.push(
      ...section(
        'Events',
        `${typePrefix}Events`,
        meta.typeParams,
        events.flatMap((event) => [
          ...docComment(event),
          `${memberKey(event.name)}: ${event.type};`,
        ])
      )
    );
  }

  if (slots.length > 0) {
    parts.push(
      ...section(
        'Slots',
        `${typePrefix}Slots`,
        meta.typeParams,
        slots.flatMap((slot) => [...docComment(slot), `${memberKey(slot.name)}: ${slot.type};`]),
        'Each slot is typed with the props it passes to its content.'
      )
    );
  }

  if (exposed.length > 0) {
    parts.push(
      ...section(
        'Exposed',
        `${typePrefix}Exposed`,
        meta.typeParams,
        exposed.flatMap((member) => [
          ...docComment(member),
          `${memberKey(member.name)}: ${member.type};`,
        ]),
        'Available on the component instance through a template ref.'
      )
    );
  }

  return parts.join('\n').trim();
}

function memberKey(name: string): string {
  return IDENTIFIER.test(name) ? name : `'${name}'`;
}

// `v-model` binds `modelValue`; every other prop paired with an `update:` event is a named model.
function modelBinding(propName: string): string {
  return propName === 'modelValue' ? 'v-model' : `v-model:${propName}`;
}

// Volar leaves fields it cannot extract (e.g. event descriptions) absent at runtime despite the
// declared types, so both reads stay guarded.
function docComment(member: DocMember, defaultValue?: string): string[] {
  const description = member.description?.trim() ?? '';
  const tags = member.tags ?? [];
  const tagLines = tags.map((tag) => `@${tag.name}${tag.text ? ` ${tag.text}` : ''}`);
  if (defaultValue !== undefined && !tags.some((tag) => tag.name === 'default')) {
    tagLines.push(`@default ${defaultValue}`);
  }

  if (!description && tagLines.length === 0) {
    return [];
  }
  if (!description && tagLines.length === 1) {
    return [`/** ${tagLines[0]} */`];
  }
  if (!description.includes('\n') && tagLines.length === 0) {
    return [`/** ${description} */`];
  }

  const body = description.split('\n').map((line) => (line.trim() ? ` * ${line}` : ' *'));
  return [
    '/**',
    ...(description ? body : []),
    ...(tagLines.length
      ? [...(description ? [' *'] : []), ...tagLines.map((tag) => ` * ${tag}`)]
      : []),
    ' */',
  ];
}

function propLine(prop: PropMeta, marker = ''): string[] {
  const optional = prop.required ? '' : '?';
  const type = prop.type.replace(' | undefined', '');
  return [
    ...docComment(prop, prop.default),
    `${memberKey(prop.name)}${optional}: ${type};${marker}`,
  ];
}

function section(
  heading: string,
  typeName: string,
  typeParams: string | undefined,
  lines: string[],
  intro?: string
): string[] {
  const aliasTypeParams = typeParams ? `<${typeParams}>` : '';
  return [
    `## ${heading}`,
    '',
    ...(intro ? [intro, ''] : []),
    '```',
    `export type ${typeName}${aliasTypeParams} = {`,
    ...indent(lines.join('\n')).split('\n'),
    '}',
    '```',
    '',
  ];
}
