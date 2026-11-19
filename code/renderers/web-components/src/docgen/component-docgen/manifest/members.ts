import type {
  ManifestClassField,
  ManifestClassMember,
  ManifestClassMethod,
  ManifestParameter,
} from './types.ts';

export function isPublicField(member: ManifestClassMember): member is ManifestClassField {
  return isField(member) && isPublicMember(member);
}

export function isPublicMethod(member: ManifestClassMember): member is ManifestClassMethod {
  return isMethod(member) && isPublicMember(member);
}

export function formatParameters(method: ManifestClassMethod): string {
  return (method.parameters ?? []).map(formatParameter).join(', ');
}

export function isField(member: ManifestClassMember): member is ManifestClassField {
  return member.kind === 'field';
}

function isPublicMember(member: ManifestClassMember): boolean {
  return (
    member.privacy !== 'private' &&
    member.privacy !== 'protected' &&
    member.static !== true &&
    !member.name.startsWith('#')
  );
}

function isMethod(member: ManifestClassMember): member is ManifestClassMethod {
  return member.kind === 'method';
}

function formatParameter(parameter: ManifestParameter): string {
  const restPrefix = parameter.rest ? '...' : '';
  const optionalSuffix = parameter.optional ? '?' : '';
  const typeText = parameter.type?.text ? `: ${parameter.type.text}` : '';
  const defaultText = parameter.default !== undefined ? ` = ${parameter.default}` : '';

  return `${restPrefix}${parameter.name}${optionalSuffix}${typeText}${defaultText}`;
}
