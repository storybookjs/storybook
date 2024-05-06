import { compile, type BaseNode, type LegacySvelteNode } from 'svelte/compiler';

import dedent from 'dedent';
import { extractId } from './extract-id.js';
import type { MetaDef, StoriesDef, StoryDef } from './types.js';
import { walk, type Node } from 'estree-walker';

function lookupAttribute(name: string, attributes: any[]) {
  return attributes.find(
    (att: any) =>
      (att.type === 'Attribute' && att.name === name) ||
      (att.type === 'Property' && att.key.name === name)
  );
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
  const finalTags = getStaticBooleanAttribute('autodocs', attributes) ? ['autodocs'] : [];

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
      elements.forEach((e: any) => finalTags.push(e.value));
      valid = true;
    } else if (type === 'MustacheTag' && expression.type === 'ArrayExpression') {
      // tags={["autodocs"]} in template
      const { elements } = expression;
      elements.forEach((e: any) => finalTags.push(e.value));
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
  const { ast } = compile(component, {});

  const allocatedIds: string[] = ['default'];

  const localNames = {
    Story: 'Story',
    Template: 'Template',
    Meta: 'Meta',
  };

  if (ast.instance) {
    walk(ast.instance, {
      enter(node) {
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
    walk(ast.instance, {
      enter(node) {
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
    walk(ast.module.content, {
      enter(node) {
        if (
          node.type === 'ExportNamedDeclaration' &&
          node.declaration?.type === 'VariableDeclaration' &&
          node.declaration?.declarations.length === 1 &&
          (node.declaration?.declarations[0]?.id as { name?: string })?.name === 'meta'
        ) {
          if (node.declaration?.kind !== 'const') {
            throw new Error('meta should be exported as const');
          }

          const init = node.declaration?.declarations[0]?.init;
          if (init?.type !== 'ObjectExpression') {
            throw new Error('meta should export on object');
          }

          fillMetaFromAttributes(meta, init.properties);
          if ((node.leadingComments?.length ?? 0) > 0) {
            // throws dedent expression is not callable.
            // @ts-ignore
            meta.description = dedent(node.leadingComments[0].value.replaceAll(/^ *\*/gm, ''));
          }
        }
      },
    });
  }
  let latestComment: string | undefined;
  walk(ast.html, {
    enter(node1) {
      // Use correct type for svelte nodes, not sure why walk isn't generic over anything that extends Node
      const node = node1 as unknown as LegacySvelteNode;
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
            const { start } = node.children[0] as BaseNode;
            const { end } = node.children[node.children.length - 1] as BaseNode;

            // throws dedent expression is not callable.
            // @ts-ignore
            source = dedent`${component.substr(start, end - start)}`;
          }
          const story = {
            name,
            template: isTemplate,
            source,
            hasArgs: node.attributes.find((att) => att.type === 'Let') != null,
          };
          if (!isTemplate && latestComment) {
            // throws dedent expression is not callable.
            // @ts-ignore
            story.description = dedent`${latestComment}`;
          }
          stories[isTemplate ? `tpl:${id}` : id] = story;
          latestComment = undefined;
        }
      } else if (node.type === 'InlineComponent' && node.name === localNames.Meta) {
        this.skip();

					meta.parameters?.description = latestComment;

        latestComment = node.data?.trim();
        return;
      }
    },
    leave(node: any) {
      if (node.type !== 'Comment' && node.type !== 'Text') {
        latestComment = undefined;
      }
    },
  });
  return {
    meta,
    stories,
    allocatedIds,
  };
}
