import { StorybookSvelteCSFError } from '#utils/error';
import dedent from 'dedent';
import type { Attribute } from 'svelte/compiler';

export class InvalidTemplateAttribute extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.codemod;
  readonly code = 1;
  public documentation = true;

  public attribute: Attribute;

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
      'Story' component prop 'template' value must be a text (string) with a reference to existing '<Template>' component id.

      The issue occurred in Stories file: ${this.filepathURL}
    `;
  }
}
