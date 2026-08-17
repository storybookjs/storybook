import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

interface Member {
  name: string;
  description: string | undefined;
  type: string | undefined;
  required: boolean;
  defaultValue: string | undefined;
}

// `table.type.required` is Angular's own addition to the argType shape, which `InputType` does not
// declare, so the section it lives in is read structurally.
type AngularTable = {
  category?: string;
  type?: { summary?: string; required?: boolean };
  defaultValue?: { summary?: string };
};

const readMember = (name: string, argType: StrictInputType): Member => {
  const table = argType.table as AngularTable | undefined;
  return {
    name,
    description: argType.description,
    type: table?.type?.summary,
    required: table?.type?.required !== false,
    defaultValue: table?.defaultValue?.summary,
  };
};

// The default belongs in the doc comment rather than after an `=`: the analyzer unquotes string
// defaults for the props table, so `label: string = Click me` would be the only shape available
// inline, and re-quoting cannot tell a string literal from an identifier the source referenced.
const docComment = (member: Member): string[] => {
  const description = member.description?.trim();
  const body = description ? description.split('\n').map((line) => line.trimEnd()) : [];

  if (member.defaultValue !== undefined) {
    if (body.length > 0) {
      body.push('');
    }
    body.push(`@default ${member.defaultValue}`);
  }

  if (body.length === 0) {
    return [];
  }
  if (body.length === 1) {
    return [`  /** ${body[0]} */`];
  }
  return ['  /**', ...body.map((line) => (line ? `   * ${line}` : '   *')), '   */'];
};

const inputLine = (member: Member, isTwoWay: boolean): string => {
  const optional = member.required ? '' : '?';
  const line = `  ${member.name}${optional}: ${member.type ?? 'any'};`;
  return isTwoWay ? `${line} // two-way: [(${member.name})]` : line;
};

// An output is subscribed to rather than passed, so it carries neither optionality nor a default.
const outputLine = (member: Member): string => `  ${member.name}: ${member.type ?? 'any'};`;

const section = (heading: string, typeName: string, lines: string[]): string[] => [
  `## ${heading}`,
  '',
  '```',
  `export type ${typeName} = {`,
  ...lines,
  '}',
  '```',
  '',
];

/**
 * Renders a component's template-facing surface as the Markdown `apiDescription` carries to agents.
 *
 * Expects argTypes extracted in `api` mode, whose members are exactly the ones a consuming template
 * can bind. Returns `undefined` when the component binds nothing, so the field is omitted rather
 * than set to an empty string.
 */
export function buildApiDescription(
  argTypes: StrictArgTypes,
  componentName: string
): string | undefined {
  const inputs: Member[] = [];
  const outputs: Member[] = [];

  for (const [name, argType] of Object.entries(argTypes)) {
    const category = (argType.table as AngularTable | undefined)?.category;
    if (category === 'inputs') {
      inputs.push(readMember(name, argType));
    } else if (category === 'outputs') {
      outputs.push(readMember(name, argType));
    }
  }

  if (inputs.length === 0 && outputs.length === 0) {
    return undefined;
  }

  // An input `X` is bindable as `[(X)]` exactly when the component also emits `XChange`.
  const outputNames = new Set(outputs.map((output) => output.name));
  const typePrefix = componentName.replace(/\W+/g, '');
  const parts: string[] = [];

  if (inputs.length > 0) {
    parts.push(
      ...section(
        'Inputs',
        `${typePrefix}Inputs`,
        inputs.flatMap((input) => [
          ...docComment(input),
          inputLine(input, outputNames.has(`${input.name}Change`)),
        ])
      )
    );
  }

  if (outputs.length > 0) {
    parts.push(
      ...section(
        'Outputs',
        `${typePrefix}Outputs`,
        outputs.flatMap((output) => [...docComment(output), outputLine(output)])
      )
    );
  }

  return parts.join('\n').trim();
}
