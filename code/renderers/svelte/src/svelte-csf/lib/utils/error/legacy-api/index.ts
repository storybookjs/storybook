import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import { StorybookSvelteCSFError } from '$lib/utils/error';
import dedent from 'dedent';

import type { SvelteAST } from '$lib/parser/ast';

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

export class DuplicatedUnidentifiedTemplateError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.legacyAPI;
  readonly code = 3;
  public documentation = true;

  constructor(filename?: string) {
    super({ filename });
  }

  template(): string {
    return dedent`
      Stories file: ${this.filename}
      has two '<Template />' components without provided prop 'id'. This leads to unwanted runtime behavior.

      Please provide an 'id' to one of them.
      And for the '<Story />' component(s) which are supposed to use it, add the 'template' prop with the same 'id' value.
    `;
  }
}
