import type { VariableDeclaration } from 'estree';
import type { getStoriesIdentifiers } from '../../../parser/analyse/Story/attributes/identifiers.js';

interface Params {
  storyIdentifiers: ReturnType<typeof getStoriesIdentifiers>;
  filename: string;
}

export const createCodeByStoryMap = (params: Params): VariableDeclaration => {
    const { storyIdentifiers } = params;

    return {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: '__codeByStory',
          },
          init: {
            type: 'ObjectExpression',
            properties: storyIdentifiers.map((storyIdentifier) => ({
                type: 'Property',
                key: {
                    type: 'Identifier',
                    name: storyIdentifier.exportName
                },
                value: {
                    type: 'Literal',
                    // TODO: use actual value from somewhere
                    value: '<MyComponent {...args} someProp={args.someArg} />'
                },
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
            }))
          }
        },
      ],
    };
  
};
