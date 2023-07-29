import * as svelte from 'svelte/compiler';
import type { Node } from 'estree';

import { storyNameFromExport, toId } from '@storybook/csf';

import dedent from 'dedent';
import { extractId } from './extract-id.js';

interface StoryDef {
  storyId: string;
  name: string;
  template: boolean;
  source: string;
  hasArgs: boolean;
}

interface MetaDef {
  title?: string;
  id?: string;
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
            storyId: toId(meta.id || meta.title || id, storyNameFromExport(id)),
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
      }
    },
  });

  return {
    meta,
    stories,
    allocatedIds,
  };
}
