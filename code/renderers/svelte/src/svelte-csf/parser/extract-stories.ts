import * as svelte from 'svelte/compiler';
import type { Node } from 'estree';

import dedent from 'dedent';
import { extractId } from './extract-id.js';

interface StoryDef {
  name: string;
  template: boolean;
  source: string;
  hasArgs: boolean;
}

interface MetaDef {
  title?: string;
  id?: string;
  tags?: string[];
}

interface StoriesDef {
  meta: MetaDef;
  stories: Record<string, StoryDef>;
  allocatedIds: string[];
}

function getStaticAttribute(name: string, node: any): string | undefined {
  // extract the attribute
  const attribute = node.attributes.find(
    (att: any) => att.type === 'Attribute' && att.name === name
  );

  if (!attribute) {
    return undefined;
  }

  const { value } = attribute;
  // expect the attribute to be static, ie only one Text node
  if (value && value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(`Attribute ${name} is not static`);
}

function getStaticBooleanAttribute(name: string, node: any): boolean | undefined {
  // extract the attribute
  const attribute = node.attributes.find(
    (att: any) => att.type === 'Attribute' && att.name === name
  );

  if (!attribute) {
    return undefined;
  }

  const { value } = attribute;

  // expect the attribute to be static and a boolean
  if (typeof value === 'boolean') {
    return value;
  }

  throw new Error(`Attribute ${name} is not a static boolean`);
}

function getMetaTags(node: any): string[] {

  const finalTags = getStaticBooleanAttribute('autodocs', node) ? ["autodocs"] : [];

  const tags = node.attributes.find((att: any) => att.type === 'Attribute' && att.name === 'tags');
  if (tags) {
    let valid = false;

    const { value } = tags;
    if (value && value.length === 1 ) {
      const { type, expression, data } = value[0];
      if (type === 'Text') {
        // tags="autodocs"
        finalTags.push(data);
        valid = true;
      } else if (type === 'MustacheTag' && expression.type === 'ArrayExpression') {
        // tags={["autodocs"]}
        const { elements } = expression;
        elements.forEach((e : any) => finalTags.push(e.value));
        valid = true;
      }
    }

    if (!valid) {
      throw new Error('Attribute tags should be a static string array or a string');
    }
  }

  return finalTags;
}

/**
 * Parse a Svelte component and extract stories.
 * @param component Component Source
 * @returns Map of storyName -> source
 */
export function extractStories(component: string): StoriesDef {
  // compile
  const { ast } = svelte.compile(component);

  const allocatedIds: string[] = ['default'];

  const localNames = {
    Story: 'Story',
    Template: 'Template',
    Meta: 'Meta',
  };

  if (ast.instance) {
    svelte.walk(<Node><unknown>ast.instance, {
      enter(node: any) {
        if (node.type === 'ImportDeclaration') {
          if (node.source.value === '@storybook/addon-svelte-csf') {
            node.specifiers
              .filter((n: any) => n.type === 'ImportSpecifier')
              .forEach((n: any) => {
                localNames[n.imported.name] = n.local.name;
              });
          }

          this.skip();
        }
      },
    });

    // extracts allocated Ids
    svelte.walk(<Node><unknown>ast.instance, {
      enter(node: any) {
        if (node.type === 'ImportDeclaration') {
          node.specifiers
            .map((n: any) => n.local.name)
            .forEach((name: string) => allocatedIds.push(name));
          this.skip();
        }
      },
    });
  }

  const stories: Record<string, StoryDef> = {};
  const meta: MetaDef = {};
  svelte.walk(<Node>ast.html, {
    enter(node: any) {
      if (
        node.type === 'InlineComponent' &&
        (node.name === localNames.Story || node.name === localNames.Template)
      ) {
        this.skip();

        const isTemplate = node.name === 'Template';

        // extract the 'name' attribute
        let name = getStaticAttribute('name', node);

        // templates has a default name
        if (!name && isTemplate) {
          name = 'default';
        }

        const id = extractId(
          {
            id: getStaticAttribute('id', node),
            name,
          },
          isTemplate ? undefined : allocatedIds
        );

        if (name && id) {
          // ignore stories without children
          let source: string = '';
          if (node.children.length > 0) {
            const { start } = node.children[0];
            const { end } = node.children[node.children.length - 1];

            // throws dedent expression is not callable.
            // @ts-ignore
            source = dedent`${component.substr(start, end - start)}`;
          }
          stories[isTemplate ? `tpl:${id}` : id] = {
            name,
            template: isTemplate,
            source,
            hasArgs: node.attributes.find((att: any) => att.type === 'Let') != null,
          };
        }
      } else if (node.type === 'InlineComponent' && node.name === localNames.Meta) {
        this.skip();

        meta.title = getStaticAttribute('title', node);
        meta.id = getStaticAttribute('id', node);
        const tags = getMetaTags(node);
        if (tags.length > 0) {
          meta.tags = tags;
        }
      }
    },
  });

  return {
    meta,
    stories,
    allocatedIds,
  };
}
