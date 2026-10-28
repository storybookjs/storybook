import { dedent } from 'ts-dedent';

import type { getStoryIdentifiers } from '../../../../parser/analyse/story/attributes/identifiers.ts';
import type { ESTreeAST, SvelteAST } from '../../../../parser/ast.ts';
import {
  StorybookSvelteCSFError,
  filepathURL,
  quickStoryRawCodeIdentifier,
} from '../../../error.ts';

const category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;

type StoryIdentifiers = NonNullable<ReturnType<typeof getStoryIdentifiers>>;

const attributeValueType = ({ value }: SvelteAST.Attribute) => {
  if (value === true) {
    return true;
  }

  if (!Array.isArray(value)) {
    return (value.expression as ESTreeAST.Literal).value;
  }

  if (value[0].type === 'Text') {
    return value[0].data;
  }

  return (value[0].expression as ESTreeAST.Literal).value;
};

export class AttributeNotStringError extends StorybookSvelteCSFError {
  constructor({
    filename,
    attribute,
    component,
  }: {
    filename?: string;
    component: SvelteAST.Component;
    attribute: SvelteAST.Attribute;
  }) {
    super({
      name: 'AttributeNotStringError',
      category,
      code: 1,
      message: dedent`
        In the stories file: ${filepathURL(filename)}

        A '${quickStoryRawCodeIdentifier(component)}' has a prop '${attribute.name}' whose value must be a static literal string.
      `,
    });
  }
}

export class AttributeNotArrayError extends StorybookSvelteCSFError {
  constructor({
    filename,
    attribute,
    component,
  }: {
    filename?: string;
    component: SvelteAST.Component;
    attribute: SvelteAST.Attribute;
  }) {
    super({
      name: 'AttributeNotArrayError',
      category,
      code: 2,
      message: dedent`
        In the stories file: ${filepathURL(filename)}

        A '${quickStoryRawCodeIdentifier(component)}' has a prop'${attribute.name}' whose value was expected to be a static array.
        Instead the value type is '${attributeValueType(attribute)}'.
      `,
    });
  }
}

export class AttributeNotArrayOfStringsError extends StorybookSvelteCSFError {
  constructor({
    filename,
    attribute,
    component,
  }: {
    filename?: string;
    component: SvelteAST.Component;
    attribute: SvelteAST.Attribute;
    element: ESTreeAST.ArrayExpression['elements'][number];
  }) {
    super({
      name: 'AttributeNotArrayOfStringsError',
      category,
      code: 3,
      message: dedent`
        In the stories file: ${filepathURL(filename)}

        A '${quickStoryRawCodeIdentifier(component)}' has attribute '${attribute.name}' whose value was expected to be an array expression.
        All elements in the array must be static literal strings only, but one of the elements is of type '${attributeValueType(attribute)}'.
      `,
    });
  }
}

export class NoStoryIdentifierError extends StorybookSvelteCSFError {
  constructor(filename?: string) {
    super({
      name: 'NoStoryIdentifierError',
      category,
      code: 4,
      message: dedent`
        Missing 'name' or 'exportName' attribute (prop) in a '<Story />' definition in the stories file:  '${filepathURL(filename)}'.
        All stories must either have a 'name' or an 'exportName' prop, or both.
      `,
    });
  }
}

export class InvalidStoryExportNameError extends StorybookSvelteCSFError {
  constructor({ filename, value }: { filename?: string; value: string }) {
    super({
      name: 'InvalidStoryExportNameError',
      category,
      code: 5,
      message: dedent`
        Invalid attribute 'exportName' value '${value}' found in '<Story />' component inside stories file: ${filepathURL(filename)}

        'exportName' value must be a valid JavaScript variable name.
        It must start with a letter, $ or _, followed by letters, numbers, $ or _.
        Reserved words like 'default' are also not allowed (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words)
      `,
    });
  }
}

export class DuplicateStoryIdentifiersError extends StorybookSvelteCSFError {
  constructor({
    filename,
    identifiers,
    duplicateIdentifiers,
  }: {
    filename?: string;
    identifiers: StoryIdentifiers;
    duplicateIdentifiers: StoryIdentifiers;
  }) {
    const story = ({ name, exportName }: StoryIdentifiers) =>
      `<Story name=${name ? `"${name}"` : '{undefined}'} exportName="${exportName}" ... />`;

    super({
      name: 'DuplicateStoryIdentifiersError',
      category,
      code: 6,
      message: dedent`
        Duplicate exportNames found between two '<Story />' definitions in stories file: ${filepathURL(filename)}

        First instance: ${story(duplicateIdentifiers)}
        Second instance: ${story(identifiers)}

        This can happen when 'exportName' is implicitly derived by 'name'.
        Complex names will be simplified to a PascalCased, valid JavaScript variable name,
        eg. 'Some story name!!' will be converted to 'SomeStoryName'.
        You can fix this collision by providing a unique 'exportName' prop with <Story exportName="SomeUniqueExportName" ... />.
      `,
    });
  }
}

export class StoryTemplateAndChildrenError extends StorybookSvelteCSFError {
  constructor({ filename, component }: { filename?: string; component: SvelteAST.Component }) {
    super({
      name: 'StoryTemplateAndChildrenError',
      category,
      code: 7,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' has both a 'template' prop and children elements defined, which is not allowed.
        Use the 'template' snippet to define the story's content structure.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryTemplateAndAsChildError extends StorybookSvelteCSFError {
  constructor({ filename, component }: { filename?: string; component: SvelteAST.Component }) {
    super({
      name: 'StoryTemplateAndAsChildError',
      category,
      code: 8,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' has both a 'template' prop and the 'asChild' prop set.
        Use the 'template' snippet to define the story's content structure.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryAsChildWithoutChildrenError extends StorybookSvelteCSFError {
  constructor({ filename, component }: { filename?: string; component: SvelteAST.Component }) {
    super({
      name: 'StoryAsChildWithoutChildrenError',
      category,
      code: 9,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' has the 'asChild' prop set, but no children were provided. The 'asChild' prop requires children to render the story content.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryExtendWithoutFactoryError extends StorybookSvelteCSFError {
  constructor({ filename, component }: { filename?: string; component: SvelteAST.Component }) {
    super({
      name: 'StoryExtendWithoutFactoryError',
      category,
      code: 10,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' has the 'extend' prop, but the stories file calls 'defineMeta()'.
        Only the stories of 'preview.meta()' can extend another story.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryExtendNotFoundError extends StorybookSvelteCSFError {
  constructor({
    filename,
    component,
    extend,
    suggestedName,
  }: {
    filename?: string;
    component: SvelteAST.Component;
    extend: string;
    suggestedName?: string;
  }) {
    super({
      name: 'StoryExtendNotFoundError',
      category,
      code: 11,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' extends the story '${extend}', but no story in the file has the name '${extend}'.
        The 'extend' prop takes the 'name' of a story in the same file, not its 'exportName'.${
          suggestedName ? `\nDid you mean extend="${suggestedName}"?` : ''
        }
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryExtendUnnamedError extends StorybookSvelteCSFError {
  constructor({
    filename,
    component,
    extend,
  }: {
    filename?: string;
    component: SvelteAST.Component;
    extend: string;
  }) {
    super({
      name: 'StoryExtendUnnamedError',
      category,
      code: 12,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' extends the story with the exportName '${extend}', but that story has no 'name' prop.
        The 'extend' prop takes the 'name' of a story. Give the story a name, for example <Story name="${extend}" />, and extend that name.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryExtendDuplicateNameError extends StorybookSvelteCSFError {
  constructor({
    filename,
    component,
    extend,
  }: {
    filename?: string;
    component: SvelteAST.Component;
    extend: string;
  }) {
    super({
      name: 'StoryExtendDuplicateNameError',
      category,
      code: 13,
      message: dedent`
        A '${quickStoryRawCodeIdentifier(component)}' extends the story '${extend}', but more than one story in the file has the name '${extend}'.
        Give the story to extend a unique name.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}

export class StoryExtendCycleError extends StorybookSvelteCSFError {
  constructor({ filename, names }: { filename?: string; names: string[] }) {
    super({
      name: 'StoryExtendCycleError',
      category,
      code: 14,
      message: dedent`
        Stories extend each other in a cycle: ${names.map((name) => `'${name}'`).join(' extends ')}.
        Remove the 'extend' prop from one of these stories.
        Found in file: ${filepathURL(filename)}
      `,
    });
  }
}
