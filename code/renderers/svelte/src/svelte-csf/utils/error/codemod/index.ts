import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
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
      'Story' component prop 'template' value must be a string with a reference to existing '<Template>' component id.

      The issue occurred in Stories file: ${this.filepathURL}
    `;
  }
}

export class LegacyTemplateNotEnabledError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.codemod;
  readonly code = 2;
  public documentation = true;

  public componentName: string;

  constructor(componentName: string) {
    super({ filename: undefined });
    this.componentName = componentName;
  }

  template(): string {
    return dedent`
      One of your stories file is using legacy API component - '<${this.componentName}>'.
      To enable support for it, enable 'legacyTemplate' in "${pkg.name}" option.
    `;
  }
}
