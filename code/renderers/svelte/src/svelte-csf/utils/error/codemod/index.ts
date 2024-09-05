import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import { StorybookSvelteCSFError } from '#utils/error';
import dedent from 'dedent';

import type { SvelteAST } from '#parser/ast';

export class InvalidTemplateAttribute extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.legacyAPI;
  readonly code = 1;
  public documentation = true;

  public attribute: SvelteAST.Attribute;

  constructor({
    filename,
    attribute,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    attribute: InvalidTemplateAttribute['attribute'];
  }) {
    super({ filename });
    this.attribute = attribute;
  }

  template(): string {
    return dedent`
      'Story' component prop 'template' value must be a string with a reference to existing '<Template>' component id.

      The issue occurred in Stories file: ${this.filepathURL}
    `;
  }
}

export class LegacyTemplateNotEnabledError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.legacyAPI;
  readonly code = 2;
  public documentation = true;

  constructor(filename?: string) {
    super({ filename });
  }

  template(): string {
    return dedent`
      Stories file: ${this.filename}
      is using legacy API.

      To enable support for it, enable 'legacyTemplate' in "${pkg.name}" option.
    `;
  }
}
