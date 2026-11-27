import { namedItems } from '../utils.ts';
import { isField, isPublicField, isPublicMethod } from './members.ts';
import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestClassMethod,
  ManifestCssCustomProperty,
  ManifestCssCustomState,
  ManifestCssPart,
  ManifestDeclaration,
  ManifestEvent,
  ManifestSlot,
} from './types.ts';

export type AttributeApi = { attribute: ManifestAttribute; field: ManifestClassField | undefined };

export type DeclarationApi = {
  attributes: AttributeApi[];
  fields: ManifestClassField[];
  methods: ManifestClassMethod[];
  events: ManifestEvent[];
  slots: ManifestSlot[];
  cssProperties: ManifestCssCustomProperty[];
  cssParts: ManifestCssPart[];
  cssStates: ManifestCssCustomState[];
};

export function classifyDeclaration(declaration: ManifestDeclaration): DeclarationApi {
  const members = namedItems(declaration.members);
  const fields = members.filter(isField);
  const attributes = namedItems(declaration.attributes).flatMap((attribute) => {
    const field = backingField(attribute, fields);

    if (field && !isPublicField(field)) {
      return [];
    }

    return [{ attribute, field }];
  });

  return {
    attributes,
    fields: fields.filter(isPublicField),
    methods: members.filter(isPublicMethod),
    events: namedItems(declaration.events),
    slots: namedItems(declaration.slots),
    cssProperties: namedItems(declaration.cssProperties),
    cssParts: namedItems(declaration.cssParts),
    cssStates: namedItems(declaration.cssStates),
  };
}

export function isBackedByAttribute(
  field: ManifestClassField,
  attributes: AttributeApi[]
): boolean {
  return attributes.some((attribute) => isAttributeField(attribute, field));
}

/** Arg types keep differently named backing fields as their own property rows; only a same-named field merges into the attribute row. */
export function foldsIntoAttributeRow(
  field: ManifestClassField,
  attributes: AttributeApi[]
): boolean {
  return attributes.some(
    (attribute) => attribute.attribute.name === field.name && isAttributeField(attribute, field)
  );
}

/** Name equality only counts when the attribute names no `fieldName`; otherwise `value` could claim an unrelated `value` field. */
function isAttributeField(
  { attribute, field: backingField }: AttributeApi,
  field: ManifestClassField
): boolean {
  return (
    backingField === field || (attribute.fieldName === undefined && attribute.name === field.name)
  );
}

function backingField(
  attribute: ManifestAttribute,
  fields: ManifestClassField[]
): ManifestClassField | undefined {
  return attribute.fieldName === undefined
    ? undefined
    : fields.find((field) => field.name === attribute.fieldName);
}
