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

import type { TemplateExpansion } from './story-docs-markup.ts';

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
  private readonly seenExpansionMarkers = new Set<string>();
  private inEventHandler = false;
  private builtinAnyReceiver: PropertyRead | undefined;

  constructor(
    target: BoundTarget<DirectiveMeta>,
    expansions: ReadonlyMap<string, TemplateExpansion>
  ) {
    super();
    this.target = target;
    this.expansions = expansions;
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
      const outputAttributes = expansion.outputAttributes.filter(
        ({ name }) => !occupiedOutputs.has(name)
      );
      outputAttributes.forEach(({ name }) => {
        occupiedOutputs.add(name);
        this.boundOutputs.add(name);
      });
      this.replacements.push({
        marker: attribute.name,
        start: attribute.sourceSpan.start.offset,
        end: attribute.sourceSpan.end.offset,
        text: [...expansion.inputAttributes, ...outputAttributes.map(({ markup }) => markup)].join(
          ' '
        ),
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
  expansions: readonly TemplateExpansion[] = []
): StoryTemplateAnalysis => {
  const expansionMap = new Map(expansions.map((expansion) => [expansion.marker, expansion]));
  try {
    const parsed = parseTemplate(markup, 'storybook-template.html');
    if (parsed.errors) {
      return {
        kind: 'unresolvable',
        markup: materializeWithoutAnalysis(markup, expansions),
        errors: parsed.errors.map((error) => error.toString()),
      };
    }

    const target = new R3TargetBinder<DirectiveMeta>(null).bind({ template: parsed.nodes });
    const visitor = new StoryTemplateVisitor(target, expansionMap);
    parsed.nodes.forEach((node) => visitor.visit(node));
    const missingExpansion = visitor.replacements.length !== expansions.length;
    if (missingExpansion) {
      visitor.errors.add('An argsToTemplate expression is not inside an element start tag.');
    }
    const materializedMarkup = missingExpansion
      ? materializeWithoutAnalysis(markup, expansions, visitor.replacements)
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
      markup: materializeWithoutAnalysis(markup, expansions),
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
};

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
        text: [
          ...expansion.inputAttributes,
          ...expansion.outputAttributes.map(({ markup: attribute }) => attribute),
        ].join(' '),
      },
    ];
  });
  return applyReplacements(markup, [...replacements, ...fallbackReplacements]);
};
