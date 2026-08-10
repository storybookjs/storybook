import { buildTemplate, formatInputValue, formatPropInTemplate } from '../template-grammar.ts';

// `raw` carries the source text of an arg no static evaluation could reduce to a value.
export type SnippetArgValue = { kind: 'value'; value: unknown } | { kind: 'raw'; text: string };

export interface SnippetInputBinding {
  name: string;
  value: SnippetArgValue;
}

export interface RenderComponentSnippetInput {
  selector: string;
  inputs: SnippetInputBinding[];
  // `model()` outputs arrive already `Change`-suffixed.
  outputs: string[];
}

// Binding values are delimited by double quotes, so a raw expression containing one would close its
// own attribute. The entity survives the template parser and reads back as the original quote.
const formatArgValue = (value: SnippetArgValue): string =>
  value.kind === 'raw' ? value.text.replace(/"/g, '&quot;') : formatInputValue(value.value);

export const renderComponentSnippet = ({
  selector,
  inputs,
  outputs,
}: RenderComponentSnippetInput): string =>
  buildTemplate(selector, {
    inputs:
      inputs.length > 0
        ? ` ${inputs.map(({ name, value }) => `[${name}]="${formatArgValue(value)}"`).join(' ')}`
        : '',
    outputs:
      outputs.length > 0
        ? ` ${outputs.map((name) => `(${name})="${formatPropInTemplate(name)}($event)"`).join(' ')}`
        : '',
  });
