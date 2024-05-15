import { logger } from '@storybook/node-logger';
import dedent from 'dedent';
import type { Node } from 'estree';
import { walk } from 'estree-walker';
import {
  type Attribute,
  type LegacyInlineComponent,
  type LegacySvelteNode,
  type Root,
  type SvelteNode,
} from 'svelte/compiler';

import {
  type FragmentMeta,
  type InstanceMeta,
  type StoryMeta,
  type TemplateMeta,
} from '../types.js';

/** NOTE: Fragment is the 'html' code - not the one innside `<script>` nor `<style>` */
export function walkOnFragment({
  fragment,
  rawSource,
  addonComponents,
}: {
  fragment: Root['fragment'];
  rawSource: string;
  addonComponents: InstanceMeta['addonComponents'];
}): FragmentMeta {
  const fragmentMeta: FragmentMeta = {
    templates: {},
    stories: {},
  };

  let latestComment: string | undefined;

  const templatesIds = new Set<string>(Object.keys(fragmentMeta.templates));
  const storiesIds = new Set<string>(Object.keys(fragmentMeta.stories));

  walk(<Node>(<unknown>fragment), {
    // TODO: Migrate to `SvelteNode`
    enter(node: LegacySvelteNode) {
      if (node.type === 'Comment') {
        latestComment = node.data.trim();
      }

      if (node.type === 'InlineComponent') {
        this.skip();

        if (node.name === addonComponents['Story']) {
          const storyMeta = walkOnStoryComponent({
            node,
            rawSource,
            latestComment,
            allocatedIds: storiesIds,
          });

          // if (
          // 	storyMeta.templateId
          // 	// storyMeta.templateId === "default" &&
          // 	// !templatesIds.has("default")
          // ) {
          //      const template = fragmentMeta.templates[storyMeta.templateId];
          // 	// const templateMeta = createDefaultTemplateMeta();
          //
          // 	Object.assign(fragmentMeta.templates, {
          // 		[templateMeta.id]: templateMeta.templates[templateMeta.id],
          // 	});
          // }

          // if (!templatesIds.has(storyMeta.templateId)) {
          // 	const message = `Unrecognized template id ${storyMeta.templateId}, if it exists after the <Story>, please move it before.`;
          // 	logger.error(message);
          // 	// throw new Error(message);
          // }

          Object.assign(fragmentMeta.stories, { [storyMeta.name]: storyMeta });
        }

        if (node.name === addonComponents['Template']) {
          const templateMeta = walkOnTemplateComponent({
            node,
            rawSource,
          });

          if (templatesIds.has(templateMeta.id)) {
            logger.error(`You're overriding the previous <Template id="${templateMeta.id}">`);
          }

          Object.assign(fragmentMeta.templates, {
            [templateMeta.id]: templateMeta,
          });

          this.skip();
        }
      }
    },
    leave(node: LegacySvelteNode) {
      if (node.type !== 'Comment' && node.type !== 'Text') {
        latestComment = undefined;
      }
    },
  });

  return fragmentMeta;
}

function walkOnTemplateComponent({
  node,
  rawSource,
}: {
  node: LegacyInlineComponent;
  rawSource: string;
}): TemplateMeta {
  const { attributes } = node;
  const id = getStaticStringFromAttribute('id', attributes) ?? 'default';
  const childrenRawSource = getChildrenRawSource({
    component: node,
    rawSource,
  });

  return {
    id,
    rawSource: childrenRawSource,
  };
}

function walkOnStoryComponent({
  node,
  rawSource,
  latestComment,
  allocatedIds,
}: {
  node: LegacyInlineComponent;
  rawSource: string;
  latestComment?: string;
  allocatedIds: Set<string>;
}): StoryMeta {
  const { attributes } = node;
  const name = getStaticStringFromAttribute('name', attributes) ?? 'Default';
  const id = extractStoryId({ name, attributes, allocatedIds });
  const childrenRawSource = getChildrenRawSource({
    component: node,
    rawSource,
  });
  const templateId =
    getStaticStringFromAttribute('templateId', attributes) ??
    (childrenRawSource ? undefined : 'default');
  const description = latestComment ? dedent`${latestComment}` : undefined;

  return {
    id,
    name,
    description,
    templateId,
    rawSource: childrenRawSource,
  };
}

function lookupAttribute(name: string, attributes: LegacyInlineComponent['attributes']) {
  return attributes.find((node) => {
    if (node.type === 'Attribute' && node.name === name) {
      return node.value;
    }
  }) as Attribute | undefined;
}

function getStaticStringFromAttribute(
  name: string,
  attributes: LegacyInlineComponent['attributes']
) {
  const attribute = lookupAttribute(name, attributes);

  if (!attribute) {
    return;
  }

  const { value } = attribute;

  if (value === true) {
    throw new Error(`Attribute 'name' is not a string`);
  }

  if (value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(`Attribute "name" is not static`);
}

function getStaticBooleanAttribute(
  name: string,
  attributes: LegacyInlineComponent['attributes']
): boolean | undefined {
  const attribute = lookupAttribute(name, attributes);

  if (!attribute) {
    return;
  }

  if (attribute.type === 'Attribute' && attribute.value === true) {
    return attribute.value;
  }

  throw new Error(`Attribute ${name} is not a static boolean`);
}

function getChildrenRawSource({
  component,
  rawSource,
}: {
  component: LegacyInlineComponent;
  rawSource: string;
}) {
  const { children } = component;

  // Ignore addon components without children
  if (children.length > 0) {
    // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
    const childrenSnippetBlock = children.find(
      // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
      (c) => c.type === 'SnippetBlock' && c.expression.name === 'children'
    );

    if (childrenSnippetBlock) {
      // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
      const { start } = childrenSnippetBlock.children[0];
      // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
      const { end } =
        // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
        childrenSnippetBlock.children[childrenSnippetBlock.children.length - 1];

      return dedent`${rawSource.slice(start, end)}`;
    }

    // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
    const { start } = children[0];
    // @ts-ignore FIXME: Upstream issue, new AST parser types is still WIP
    const { end } = children[children.length - 1];

    return dedent`${rawSource.slice(start, end)}`;
  }
}

function extractStoryId({
  attributes,
  name,
  allocatedIds,
}: {
  attributes: LegacyInlineComponent['attributes'];
  name: string;
  allocatedIds: Set<string>;
}): string {
  const id = getStaticStringFromAttribute('id', attributes);

  if (id) {
    return id;
  }

  let generated = name.replace(/\W+(.|$)/g, (_, chr) => chr.toUpperCase());

  if (allocatedIds.has(generated)) {
    logger.warn(`Story name conflict with exports - Please add an explicit id for story ${name}`);
    generated += hashCode(name);
  }

  return generated;
}

function hashCode(str: string): string {
  const h = str
    .split('')
    // eslint-disable-next-line no-bitwise
    .reduce((prevHash, currVal) => ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0, 0);

  return Math.abs(h).toString(16);
}
