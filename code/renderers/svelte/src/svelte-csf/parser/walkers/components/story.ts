import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { Component } from 'svelte/compiler';

import { getStringFromAttribute } from './shared.js';

export function getStoryName(attributes: Component['attributes']) {
  return getStringFromAttribute('name', attributes) ?? 'Default';
}

export function getStoryTemplateId({
  attributes,
  hasChildren,
}: {
  attributes: Component['attributes'];
  hasChildren: boolean;
}) {
  return getStringFromAttribute('templateId', attributes) ?? (hasChildren ? 'default' : undefined);
}

export function getDescription(node: Component) {
  const { parent } = node;

  if (parent?.type === 'Comment') {
    return dedent`${parent.data}`;
  }
}

export function getStoryId({
  attributes,
  name,
  storiesIds,
}: {
  attributes: Component['attributes'];
  name: string;
  storiesIds: Set<string>;
}) {
  const id = getStringFromAttribute('id', attributes);

  if (id) {
    return id;
  }

  let generated = name.replace(/\W+(.|$)/g, (_, chr) => chr.toUpperCase());

  if (storiesIds.has(generated)) {
    logger.warn(`Story name conflict with exports - Please add an explicit id for story ${name}`);
    generated += hashCode(name);
  }

  return generated;
}

function hashCode(str: string) {
  const h = str.split('').reduce((prev, curr) => ((prev << 5) - prev + curr.charCodeAt(0)) | 0, 0);

  return Math.abs(h).toString(16);
}
