import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import type {
  CustomElementsItem,
  CustomElementsItemGroups,
} from './custom-elements-manifest-types.ts';

type TableDefaultSummary = NonNullable<
  NonNullable<StrictInputType['table']>['defaultValue']
>['summary'];

const ITEM_GROUPS: [keyof CustomElementsItemGroups, string][] = [
  ['members', 'properties'],
  ['properties', 'properties'],
  ['attributes', 'attributes'],
  ['events', 'events'],
  ['slots', 'slots'],
  ['cssProperties', 'css custom properties'],
  ['cssParts', 'css shadow parts'],
];

export function mapArgTypes(groups: CustomElementsItemGroups): StrictArgTypes {
  return ITEM_GROUPS.reduce<StrictArgTypes>(
    (argTypes, [groupName, category]) => ({
      ...argTypes,
      ...mapData(groups[groupName] ?? [], category),
    }),
    {}
  );
}

function mapItem(item: CustomElementsItem, category: string): StrictInputType {
  const text = typeText(item);
  let typeName: string | undefined;
  switch (category) {
    case 'attributes':
    case 'properties':
      typeName = text;
      break;
    case 'slots':
      typeName = 'string';
      break;
    default:
      typeName = 'void';
      break;
  }

  return {
    name: item.name,
    required: false,
    description: item.description,
    // The legacy runtime keeps manifest type text as the sbType name; server docgen maps real SBTypes.
    type: { name: typeName } as StrictInputType['type'],
    table: {
      category,
      type: { summary: text },
      defaultValue: {
        summary: (item.default !== undefined
          ? item.default
          : item.defaultValue) as TableDefaultSummary,
      },
    },
  };
}

function mapEvent(item: CustomElementsItem): StrictInputType[] {
  let name = item.name
    .replace(/(-|_|:|\.|\s)+(.)?/g, (_match, _separator, chr: string) => {
      return chr ? chr.toUpperCase() : '';
    })
    .replace(/^([A-Z])/, (match) => match.toLowerCase());

  name = `on${name.charAt(0).toUpperCase() + name.slice(1)}`;

  return [{ name, action: { name: item.name }, table: { disable: true } }, mapItem(item, 'events')];
}

function mapData(items: CustomElementsItem[], category: string): StrictArgTypes {
  return items
    .filter((item) => item?.name)
    .reduce<StrictArgTypes>((acc, item) => {
      if (item.kind === 'method') {
        return acc;
      }

      switch (category) {
        case 'events':
          mapEvent(item).forEach((argType) => {
            acc[argType.name] = argType;
          });
          break;
        default:
          acc[item.name] = mapItem(item, category);
          break;
      }

      return acc;
    }, {});
}

function typeText(item: CustomElementsItem): string | undefined {
  return typeof item.type === 'string' ? item.type : item.type?.text;
}
