import type { Component } from 'svelte/compiler';

import { getStringFromAttribute } from './shared.js';

export function getTemplateId(attributes: Component['attributes']) {
  return getStringFromAttribute('id', attributes);
}
