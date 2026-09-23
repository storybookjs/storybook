import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import invariant from 'tiny-invariant';

export interface TagItem {
  name: string;
  type?: { text?: string } | string;
  description?: string;
  default?: unknown;
  kind?: string;
  defaultValue?: unknown;
}

export interface TagItemGroups {
  attributes?: TagItem[];
  properties?: TagItem[];
  events?: TagItem[];
  methods?: TagItem[];
  members?: TagItem[];
  slots?: TagItem[];
  cssProperties?: TagItem[];
  cssParts?: TagItem[];
}

export function mapArgTypes(groups: TagItemGroups): StrictArgTypes {
  return {
    ...mapData(groups.members ?? [], 'properties'),
    ...mapData(groups.properties ?? [], 'properties'),
    ...mapData(groups.attributes ?? [], 'attributes'),
    ...mapData(groups.events ?? [], 'events'),
    ...mapData(groups.slots ?? [], 'slots'),
    ...mapData(groups.cssProperties ?? [], 'css custom properties'),
    ...mapData(groups.cssParts ?? [], 'css shadow parts'),
  };
}

function mapItem(item: TagItem, category: string): StrictInputType {
  let type;
  switch (category) {
    case 'attributes':
    case 'properties':
      type = { name: (item.type as { text?: string })?.text || item.type };
      break;
    case 'slots':
      type = { name: 'string' };
      break;
    default:
      type = { name: 'void' };
      break;
  }

  return {
    name: item.name,
    required: false,
    description: item.description,
    type,
    table: {
      category,
      type: { summary: (item.type as { text?: string })?.text || item.type },
      defaultValue: {
        summary: item.default !== undefined ? item.default : item.defaultValue,
      },
    },
  } as StrictInputType;
}

function mapEvent(item: TagItem): StrictInputType[] {
  let name = item.name
    .replace(/(-|_|:|\.|\s)+(.)?/g, (_match, _separator, chr: string) => {
      return chr ? chr.toUpperCase() : '';
    })
    .replace(/^([A-Z])/, (match) => match.toLowerCase());

  name = `on${name.charAt(0).toUpperCase() + name.substr(1)}`;

  return [{ name, action: { name: item.name }, table: { disable: true } }, mapItem(item, 'events')];
}

function mapData(data: TagItem[], category: string): StrictArgTypes | undefined {
  return (
    data &&
    data
      .filter((item) => item && item.name)
      .reduce((acc, item) => {
        if (item.kind === 'method') {
          return acc;
        }

        switch (category) {
          case 'events':
            mapEvent(item).forEach((argType) => {
              invariant(argType.name, `${argType} should have a name property.`);
              acc[argType.name] = argType;
            });
            break;
          default:
            acc[item.name] = mapItem(item, category);
            break;
        }

        return acc;
      }, {} as StrictArgTypes)
  );
}
