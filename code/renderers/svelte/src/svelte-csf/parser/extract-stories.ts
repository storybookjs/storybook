import dedent from 'ts-dedent';
import * as svelte from 'svelte/compiler';
import { extractId } from './extract-id';

interface StoryDef {
  name: string;
  template: boolean;
  source: string;
  hasArgs: boolean;
}

function getStaticAttribute(name: string, node: any): string {
  // extract the attribute
  const attribute = node.attributes.find(
    (att: any) => att.type === 'Attribute' && att.name === name
  );

  if (!attribute) {
    return null;
  }

  const { value } = attribute;
  // expect the attribute to be static, ie only one Text node
  if (value && value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(`Attribute ${name} is not static`);
}

/**
 * Parse a Svelte component and extract stories.
 * @param component Component Source
 * @returns Map of storyName -> source
 */
export function extractStories(component: string): Record<string, StoryDef> {
  // compile
  const { ast } = svelte.compile(component);

  const stories: Record<string, StoryDef> = {};
  svelte.walk(ast.html, {
    enter(node: any) {
      if (node.type === 'InlineComponent' && (node.name === 'Story' || node.name === 'Template')) {
        this.skip();

        const isTemplate = node.name === 'Template';

        // extract the 'name' attribute
        let name = getStaticAttribute('name', node);

        // templates has a default name
        if (!name && isTemplate) {
          name = 'default';
        }

        const id = extractId({
          id: getStaticAttribute('id', node),
          name,
        });

        if (name && id) {
          // ignore stories without children
          let source;
          if (node.children.length > 0) {
            const { start } = node.children[0];
            const { end } = node.children[node.children.length - 1];

            source = dedent(component.substr(start, end - start));
          }

          stories[isTemplate ? `tpl:${id}` : id] = {
            name,
            template: isTemplate,
            source,
            hasArgs: node.attributes.find((att: any) => att.type === 'Let') != null,
          };
        }
      }
    },
  });

  return stories;
}
