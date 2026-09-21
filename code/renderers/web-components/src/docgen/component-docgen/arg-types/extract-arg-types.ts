import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import type { CustomElementsDeclaration } from '../manifest/resolve-declaration.ts';

interface TagItem {
  name: string;
  type?: { text?: string } | string;
  description?: string;
  default?: unknown;
  kind?: string;
  defaultValue?: unknown;
}

const typeText = (item: TagItem): string | undefined => {
  const type =
    typeof item.type === 'object' && item.type !== null && 'text' in item.type
      ? item.type.text
      : item.type;
  return type === undefined ? undefined : String(type);
};

function mapItem(item: TagItem, category: string): StrictInputType {
  let type;
  switch (category) {
    case 'attributes':
    case 'properties':
      type = { name: typeText(item) };
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
    type: type as StrictInputType['type'],
    table: {
      category,
      type: { summary: typeText(item) },
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

  name = `on${name.charAt(0).toUpperCase() + name.slice(1)}`;

  return [{ name, action: { name: item.name }, table: { disable: true } }, mapItem(item, 'events')];
}

function mapData(data: TagItem[] | undefined, category: string): StrictArgTypes | undefined {
  return (
    data &&
    data
      .filter((item) => item?.name)
      .reduce((acc, item) => {
        if (item.kind === 'method') {
          return acc;
        }

        switch (category) {
          case 'events':
            mapEvent(item).forEach((argType) => {
              if (argType.name) {
                acc[argType.name] = argType;
              }
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

export function extractArgTypesFromDeclaration(
  declaration: CustomElementsDeclaration
): StrictArgTypes {
  return {
    ...mapData(declaration.members, 'properties'),
    ...mapData(declaration.properties, 'properties'),
    ...mapData(declaration.attributes, 'attributes'),
    ...mapData(declaration.events, 'events'),
    ...mapData(declaration.slots, 'slots'),
    ...mapData(declaration.cssProperties, 'css custom properties'),
    ...mapData(declaration.cssParts, 'css shadow parts'),
  };
}
