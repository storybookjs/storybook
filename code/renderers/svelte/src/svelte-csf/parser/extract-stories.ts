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

function lookupAttribute(name: string, attributes: any[]) {
  return attributes.find((att: any) => 
    (att.type === 'Attribute' && att.name === name) || 
    (att.type === 'Property' && att.key.name === name));
}

function getStaticAttribute(name: string, node: any): string | undefined {
  // extract the attribute
  const attribute = lookupAttribute(name, node);

  if (!attribute) {
    return undefined;
  }

  const { value } = attribute;
  // expect the attribute to be static, ie only one Text node or Literal
  if (value?.type === 'Literal') {
    return value.value;
  }

  if (value && value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(`Attribute ${name} is not static`);
}

function getStaticBooleanAttribute(name: string, attributes: any[]): boolean | undefined {
  // extract the attribute
  const attribute = lookupAttribute(name, attributes);


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

function getMetaTags(attributes: any[]): string[] {

  const finalTags = getStaticBooleanAttribute('autodocs', attributes) ? ["autodocs"] : [];

  const tags = lookupAttribute('tags', attributes);

  if (tags) {
    let valid = false;

    let { value } = tags;
    if (value && value.length === 1) {
      value = value[0];
    }

    const { type, expression, data } = value;
    if (type === 'Text') {
      // tags="autodocs"
      finalTags.push(data);
      valid = true;
    } else if (type === 'ArrayExpression') {
      // tags={["autodocs"]} in object
      const { elements } = value;
      elements.forEach((e : any) => finalTags.push(e.value));
      valid = true;
    } else if (type === 'MustacheTag' && expression.type === 'ArrayExpression') {
      // tags={["autodocs"]} in template
      const { elements } = expression;
      elements.forEach((e : any) => finalTags.push(e.value));
      valid = true;
    }

    if (!valid) {
      throw new Error('Attribute tags should be a static string array or a string');
    }
  }

  return finalTags;
}

function fillMetaFromAttributes(meta: MetaDef, attributes: any[]) {
  meta.title = getStaticAttribute('title', attributes);
  meta.id = getStaticAttribute('id', attributes);
  const tags = getMetaTags(attributes);
  if (tags.length > 0) {
    meta.tags = tags;
  }
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
  if (ast.module) {
    svelte.walk(<Node>ast.module.content, {
      enter(node: any) {
        if (node.type === 'ExportNamedDeclaration' && 
          node.declaration?.type === 'VariableDeclaration' && 
          node.declaration?.declarations.length === 1 &&
          node.declaration?.declarations[0]?.id?.name === 'meta') {

            if (node.declaration?.kind !== 'const') {
              throw new Error('meta should be exported as const');
            }

            const init = node.declaration?.declarations[0]?.init;
            if (init?.type !== 'ObjectExpression') {
              throw new Error('meta should export on object');
            }

            fillMetaFromAttributes(meta, init.properties);
        }
      }
    });
  }
  svelte.walk(<Node>ast.html, {
    enter(node: any) {
      if (
        node.type === 'InlineComponent' &&
        (node.name === localNames.Story || node.name === localNames.Template)
      ) {
        this.skip();

        const isTemplate = node.name === 'Template';

        // extract the 'name' attribute
        let name = getStaticAttribute('name', node.attributes);

        // templates has a default name
        if (!name && isTemplate) {
          name = 'default';
        }

        const id = extractId(
          {
            id: getStaticAttribute('id', node.attributes),
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

        fillMetaFromAttributes(meta, node.attributes);
      }
    },
  });
  
  return {
    meta,
    stories,
    allocatedIds,
  };
}
