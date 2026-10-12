import type {
  BoundTarget,
  Call,
  DirectiveMeta,
  KeyedRead,
  SafeKeyedRead,
  SafePropertyRead,
  TmplAstBoundEvent,
  TmplAstElement,
  TmplAstTemplate,
} from '@angular/compiler';
import {
  CombinedRecursiveAstVisitor,
  ImplicitReceiver,
  LiteralPrimitive,
  PropertyRead,
  R3TargetBinder,
  ThisReceiver,
  TmplAstTextAttribute,
  parseTemplate,
} from '@angular/compiler';

import { argMarker, bindingsMarker } from '../snippet-markers.ts';
import type { TemplateExpansion, TemplateResult } from './story-docs-markup.ts';

// The text one `argsToTemplate` site becomes, given the outputs its element leaves it to bind and
// the outputs its element already binds.
type MaterializeExpansion = (
  expansion: TemplateExpansion,
  outputAttributes: TemplateExpansion['outputAttributes'],
  occupiedOutputs: ReadonlySet<string>
) => string;

const inlineBindings: MaterializeExpansion = (expansion, outputAttributes) =>
  [...expansion.inputAttributes, ...outputAttributes.map(({ markup }) => markup)].join(' ');

export type StoryTemplateAnalysis =
  | {
      kind: 'resolved';
      markup: string;
      referencedNames: string[];
      boundOutputs: string[];
    }
  | {
      kind: 'unresolvable';
      markup: string;
      errors: string[];
    };

interface Replacement {
  marker: string;
  start: number;
  end: number;
  text: string;
}

class StoryTemplateVisitor extends CombinedRecursiveAstVisitor {
  readonly referencedNames = new Set<string>();
  readonly boundOutputs = new Set<string>();
  readonly errors = new Set<string>();
  readonly replacements: Replacement[] = [];

  private readonly target: BoundTarget<DirectiveMeta>;
  private readonly expansions: ReadonlyMap<string, TemplateExpansion>;
  private readonly materialize: MaterializeExpansion;
  private readonly seenExpansionMarkers = new Set<string>();
  private inEventHandler = false;
  private builtinAnyReceiver: PropertyRead | undefined;

  constructor(
    target: BoundTarget<DirectiveMeta>,
    expansions: ReadonlyMap<string, TemplateExpansion>,
    materialize: MaterializeExpansion
  ) {
    super();
    this.target = target;
    this.expansions = expansions;
    this.materialize = materialize;
  }

  override visitElement(element: TmplAstElement): void {
    this.recordExpansions(element.attributes, element.outputs);
    super.visitElement(element);
  }

  override visitTemplate(template: TmplAstTemplate): void {
    this.recordExpansions(
      [
        ...template.attributes,
        ...template.templateAttrs.filter(
          (attribute): attribute is TmplAstTextAttribute =>
            attribute instanceof TmplAstTextAttribute
        ),
      ],
      template.outputs
    );
    super.visitTemplate(template);
  }

  override visitPropertyRead(ast: PropertyRead): void {
    this.recordComponentReference(ast);
    super.visitPropertyRead(ast, undefined);
  }

  override visitSafePropertyRead(ast: SafePropertyRead): void {
    this.recordComponentReference(ast);
    super.visitSafePropertyRead(ast, undefined);
  }

  override visitKeyedRead(ast: KeyedRead): void {
    this.recordComponentKey(ast);
    super.visitKeyedRead(ast, undefined);
  }

  override visitSafeKeyedRead(ast: SafeKeyedRead): void {
    this.recordComponentKey(ast);
    super.visitSafeKeyedRead(ast, undefined);
  }

  override visitCall(ast: Call): void {
    const previous = this.builtinAnyReceiver;
    this.builtinAnyReceiver = isBuiltinAnyCall(ast) ? ast.receiver : undefined;
    try {
      super.visitCall(ast, undefined);
    } finally {
      this.builtinAnyReceiver = previous;
    }
  }

  override visitBoundEvent(event: TmplAstBoundEvent): void {
    this.boundOutputs.add(event.name);
    const wasInEventHandler = this.inEventHandler;
    this.inEventHandler = true;
    super.visitBoundEvent(event);
    this.inEventHandler = wasInEventHandler;
  }

  private recordComponentReference(ast: PropertyRead | SafePropertyRead): void {
    if (
      this.isComponentReceiver(ast.receiver) &&
      this.target.getExpressionTarget(ast) === null &&
      ast !== this.builtinAnyReceiver &&
      !(this.inEventHandler && ast.name === '$event')
    ) {
      this.referencedNames.add(ast.name);
    }
  }

  private recordExpansions(
    attributes: readonly TmplAstTextAttribute[],
    outputs: readonly TmplAstBoundEvent[]
  ): void {
    const occupiedOutputs = new Set(outputs.map((output) => output.name));
    const markers = attributes
      .map((attribute) => ({ attribute, expansion: this.expansions.get(attribute.name) }))
      .filter(
        (entry): entry is { attribute: TmplAstTextAttribute; expansion: TemplateExpansion } =>
          entry.expansion !== undefined && !this.seenExpansionMarkers.has(entry.attribute.name)
      )
      .sort(
        (left, right) =>
          left.attribute.sourceSpan.start.offset - right.attribute.sourceSpan.start.offset
      );

    for (const { attribute, expansion } of markers) {
      this.seenExpansionMarkers.add(attribute.name);
      const occupied = new Set(occupiedOutputs);
      const outputAttributes = expansion.outputAttributes.filter(({ name }) => !occupied.has(name));
      outputAttributes.forEach(({ name }) => {
        occupiedOutputs.add(name);
        this.boundOutputs.add(name);
      });
      this.replacements.push({
        marker: attribute.name,
        start: attribute.sourceSpan.start.offset,
        end: attribute.sourceSpan.end.offset,
        text: this.materialize(expansion, outputAttributes, occupied),
      });
    }
  }

  private recordComponentKey(ast: KeyedRead | SafeKeyedRead): void {
    if (!this.isComponentReceiver(ast.receiver) || this.target.getExpressionTarget(ast) !== null) {
      return;
    }
    if (ast.key instanceof LiteralPrimitive && typeof ast.key.value === 'string') {
      this.referencedNames.add(ast.key.value);
    } else {
      this.errors.add('A component-root keyed read has a dynamic key.');
    }
  }

  private isComponentReceiver(receiver: unknown): boolean {
    return receiver instanceof ImplicitReceiver || receiver instanceof ThisReceiver;
  }
}

const isBuiltinAnyCall = (ast: Call): ast is Call & { receiver: PropertyRead } =>
  ast.receiver instanceof PropertyRead &&
  ast.receiver.name === '$any' &&
  ast.receiver.receiver instanceof ImplicitReceiver &&
  !(ast.receiver.receiver instanceof ThisReceiver);

export const analyzeStoryTemplate = (
  markup: string,
  expansions: readonly TemplateExpansion[] = [],
  materialize: MaterializeExpansion = inlineBindings
): StoryTemplateAnalysis => {
  const expansionMap = new Map(expansions.map((expansion) => [expansion.marker, expansion]));
  try {
    const parsed = parseTemplate(markup, 'storybook-template.html');
    if (parsed.errors) {
      return {
        kind: 'unresolvable',
        markup: materializeWithoutAnalysis(markup, expansions, materialize),
        errors: parsed.errors.map((error) => error.toString()),
      };
    }

    const target = new R3TargetBinder<DirectiveMeta>(null).bind({ template: parsed.nodes });
    const visitor = new StoryTemplateVisitor(target, expansionMap, materialize);
    parsed.nodes.forEach((node) => visitor.visit(node));
    const missingExpansion = visitor.replacements.length !== expansions.length;
    if (missingExpansion) {
      visitor.errors.add('An argsToTemplate expression is not inside an element start tag.');
    }
    const materializedMarkup = missingExpansion
      ? materializeWithoutAnalysis(markup, expansions, materialize, visitor.replacements)
      : applyReplacements(markup, visitor.replacements);
    if (visitor.errors.size > 0) {
      return { kind: 'unresolvable', markup: materializedMarkup, errors: [...visitor.errors] };
    }

    return {
      kind: 'resolved',
      markup: materializedMarkup,
      referencedNames: [...visitor.referencedNames],
      boundOutputs: [...visitor.boundOutputs],
    };
  } catch (error) {
    return {
      kind: 'unresolvable',
      markup: materializeWithoutAnalysis(markup, expansions, materialize),
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
};

// The story's own markup with markers where it holds arg values, which the preview fills and lays
// out, or `undefined` when the markers would change what the markup reads. `argsToTemplate` binds
// every arg that holds a function, actions the controls add included, so each site lists the
// outputs its element leaves free, and `liveOutputs` names those the markup binds nowhere else.
export const markStoryTemplate = (
  { argMarkup, expansions, argTexts }: Extract<TemplateResult, { kind: 'literal' }>,
  { inputs, outputs }: { inputs: readonly string[]; outputs: readonly string[] },
  analysis: Extract<StoryTemplateAnalysis, { kind: 'resolved' }>
): { markup: string; liveOutputs: Set<string> } | undefined => {
  const siteOutputs = new Set<string>();
  // Without their static outputs the sites leave every output the markup binds itself.
  const marked = analyzeStoryTemplate(
    argMarkup,
    expansions.map((expansion) => ({ ...expansion, outputAttributes: [] })),
    (expansion, _outputAttributes, occupiedOutputs) => {
      const free = outputs.filter((name) => expansion.allows(name) && !occupiedOutputs.has(name));
      free.forEach((name) => siteOutputs.add(name));
      return bindingsMarker([
        ...inputs.filter(expansion.allows).map((name) => ({ kind: 'input' as const, name })),
        ...free.map((name) => ({ kind: 'output' as const, name })),
      ]);
    }
  );
  const staticOutputs = expansions.flatMap(({ outputAttributes }) =>
    outputAttributes.map(({ name }) => name)
  );
  if (
    marked.kind !== 'resolved' ||
    !sameNames(marked.referencedNames, analysis.referencedNames) ||
    !sameNames([...new Set([...marked.boundOutputs, ...staticOutputs])], analysis.boundOutputs)
  ) {
    return undefined;
  }
  let markup = marked.markup;
  for (const [placeholder, name] of argTexts) {
    markup = markup.replaceAll(placeholder, argMarker(name));
  }
  const ownOutputs = new Set(marked.boundOutputs);
  return {
    markup,
    liveOutputs: new Set([...siteOutputs].filter((name) => !ownOutputs.has(name))),
  };
};

const sameNames = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((name) => right.includes(name));

const applyReplacements = (markup: string, replacements: readonly Replacement[]): string => {
  let position = 0;
  let materialized = '';
  for (const replacement of [...replacements].sort((left, right) => left.start - right.start)) {
    const precedingMarkup = markup.slice(position, replacement.start);
    materialized +=
      (replacement.text === '' ? precedingMarkup.trimEnd() : precedingMarkup) + replacement.text;
    position = replacement.end;
  }
  return materialized + markup.slice(position);
};

const materializeWithoutAnalysis = (
  markup: string,
  expansions: readonly TemplateExpansion[],
  materialize: MaterializeExpansion,
  replacements: readonly Replacement[] = []
): string => {
  const replacedMarkers = new Set(replacements.map(({ marker }) => marker));
  const fallbackReplacements = expansions.flatMap((expansion): Replacement[] => {
    if (replacedMarkers.has(expansion.marker)) {
      return [];
    }
    const start = markup.indexOf(expansion.marker);
    if (start === -1) {
      return [];
    }
    return [
      {
        marker: expansion.marker,
        start,
        end: start + expansion.marker.length,
        text: materialize(expansion, expansion.outputAttributes, new Set()),
      },
    ];
  });
  return applyReplacements(markup, [...replacements, ...fallbackReplacements]);
};
