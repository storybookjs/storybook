import type { Type } from '@angular/core';
import {
  Component,
  Directive,
  Injector,
  Input,
  OutputEmitterRef,
  Output,
  Pipe,
  isSignal,
  runInInjectionContext,
  ɵReflectionCapabilities as ReflectionCapabilities,
  ɵgetComponentDef as getComponentDef,
} from '@angular/core';

const reflectionCapabilities = new ReflectionCapabilities();

export type ComponentInputsOutputs = {
  inputs: {
    propName: string;
    templateName: string;
  }[];
  outputs: {
    propName: string;
    templateName: string;
  }[];
};

/** Returns component Inputs / Outputs by browsing these properties and decorator */
export const getComponentInputsOutputs = (component: any): ComponentInputsOutputs => {
  const componentMetadata = getComponentDecoratorMetadata(component);
  const componentPropsMetadata = getComponentPropsDecoratorMetadata(component);

  const initialValue: ComponentInputsOutputs = {
    inputs: [],
    outputs: [],
  };

  // Adds the I/O present in @Component metadata
  if (componentMetadata && componentMetadata.inputs) {
    initialValue.inputs.push(
      ...componentMetadata.inputs.map((i) => ({
        propName: typeof i === 'string' ? i : i.name,
        templateName: typeof i === 'string' ? i : i.alias,
      }))
    );
  }
  if (componentMetadata && componentMetadata.outputs) {
    initialValue.outputs.push(
      ...componentMetadata.outputs.map((i) => ({ propName: i, templateName: i }))
    );
  }

  // Browses component properties to extract I/O
  // Filters properties that have the same name as the one present in the @Component property
  const decoratorDerived: ComponentInputsOutputs = !componentPropsMetadata
    ? initialValue
    : Object.entries(componentPropsMetadata).reduce((previousValue, [propertyName, values]) => {
        const value = values.find((v) => v instanceof Input || v instanceof Output);
        if (value instanceof Input) {
          const inputToAdd = {
            propName: propertyName,
            templateName: value.bindingPropertyName ?? value.alias ?? propertyName,
          };

          const previousInputsFiltered = previousValue.inputs.filter(
            (i) => i.templateName !== propertyName
          );
          return {
            ...previousValue,
            inputs: [...previousInputsFiltered, inputToAdd],
          };
        }
        if (value instanceof Output) {
          const outputToAdd = {
            propName: propertyName,
            templateName: value.bindingPropertyName ?? value.alias ?? propertyName,
          };

          const previousOutputsFiltered = previousValue.outputs.filter(
            (i) => i.templateName !== propertyName
          );
          return {
            ...previousValue,
            outputs: [...previousOutputsFiltered, outputToAdd],
          };
        }
        return previousValue;
      }, initialValue);

  // Additively surface signal-based I/O (`input()`, `output()`, `model()`), which carry
  // no decorator metadata and are therefore invisible to the decorator path above.
  // This is intentionally additive and never mutates the decorator-derived results, so
  // `@Input`/`@Output`/`EventEmitter` behavior is unchanged (zero regression).
  return addSignalInputsOutputs(component, decoratorDerived);
};

const hasEntry = (
  list: { propName: string; templateName: string }[],
  propName: string,
  templateName: string
) => list.some((e) => e.propName === propName || e.templateName === templateName);

/**
 * Surfaces signal-based I/O that the decorator-reflection path cannot see.
 *
 * Angular's `model()` lowers to a binding pair: an `x` input + a compiler-synthesized
 * `xChange` output. `input()`/`output()` are likewise decorator-less. None of these appear
 * in `ɵReflectionCapabilities.propMetadata`, so without this path Storybook never binds
 * them at runtime nor wires up the `xChange` action.
 *
 * Two complementary strategies are used (the `model()` compodoc shape this mirrors
 * is captured in the committed evidence fixture
 * `code/frameworks/angular/src/client/docs/__testfixtures__/doc-model/compodoc-input.json`):
 *
 * 1. Primary — read the Angular component definition (`ɵcmp` via `ɵgetComponentDef`).
 *    At real AOT runtime (the Angular builder used by Storybook/sandboxes) `ɵcmp.inputs`
 *    and `ɵcmp.outputs` already encode the *resolved* binding names, so aliased
 *    `model(x, { alias })` and `model.required()` are handled correctly here.
 *
 * 2. Fallback — a `model()`/`input()`/`output()`-aware synthesis from the component
 *    instance shape. In the `@storybook/angular` JIT/esbuild unit-test harness (and any
 *    consumer receiving a non-AOT-compiled class) esbuild strips the AOT signal metadata
 *    and the JIT compiler cannot reflect decorator-less signal members, so `ɵcmp.inputs`
 *    / `ɵcmp.outputs` are empty for signal members (`ɵcmp.signals === false`). The
 *    fallback detects the runtime brand of each instance field instead.
 *
 * Both paths are additive and de-duplicated against the decorator-derived results.
 */
const addSignalInputsOutputs = (
  component: any,
  base: ComponentInputsOutputs
): ComponentInputsOutputs => {
  const result: ComponentInputsOutputs = {
    inputs: [...base.inputs],
    outputs: [...base.outputs],
  };

  // 1. Primary: Angular component definition (resolved binding names, AOT-correct).
  try {
    const def: any = getComponentDef(component);
    if (def) {
      // Angular's `ɵcmp` def keys the I/O maps by the *template* (public/binding)
      // name, NOT the class property name:
      //   def.inputs:  { [templateName]: propName | [propName, flags, transform] }
      //   def.outputs: { [templateName]: propName }
      // (verified empirically; aliased `@Input('a') b` → def.inputs = { a: ['b',…] }).
      for (const templateName of Object.keys(def.inputs ?? {})) {
        const rawPropName = def.inputs[templateName];
        const propName = Array.isArray(rawPropName)
          ? (rawPropName[0] ?? templateName)
          : (rawPropName ?? templateName);
        if (!hasEntry(result.inputs, propName, templateName)) {
          result.inputs.push({ propName, templateName });
        }
      }
      for (const templateName of Object.keys(def.outputs ?? {})) {
        const propName = def.outputs[templateName] ?? templateName;
        if (!hasEntry(result.outputs, propName, templateName)) {
          result.outputs.push({ propName, templateName });
        }
      }
    }
  } catch {
    // `ɵgetComponentDef` may be unavailable for non-component classes; ignore.
  }

  // 2. Fallback: synthesize from the component instance shape when signal members were
  //    not surfaced by the component definition (non-AOT/JIT-compiled classes).
  try {
    let instance: any;
    runInInjectionContext(Injector.create({ providers: [] }), () => {
      instance = new component();
    });

    if (instance) {
      for (const propName of Object.keys(instance)) {
        const member = instance[propName];
        if (member == null) {
          continue;
        }

        // `isSignal()` narrows `member` to `Signal<unknown>`, which does not expose the
        // writable (`set`/`update`) or subscribable (`subscribe`) members that brand a
        // `model()`/`output()` at runtime. Probe those off an un-narrowed reference.
        const memberAny = member as any;
        const isWritableSignal =
          isSignal(member) &&
          typeof memberAny.set === 'function' &&
          typeof memberAny.update === 'function';
        const isSubscribable = typeof memberAny.subscribe === 'function';

        if (isWritableSignal && isSubscribable) {
          // `model()` / `model.required()`: input `x` + synthesized output `xChange`.
          // The runtime alias is not observable on the instance; the resolved binding
          // name is only available via `ɵcmp` (handled by the primary path at AOT).
          const changeName = `${propName}Change`;
          if (!hasEntry(result.inputs, propName, propName)) {
            result.inputs.push({ propName, templateName: propName });
          }
          if (!hasEntry(result.outputs, propName, changeName)) {
            result.outputs.push({ propName, templateName: changeName });
          }
        } else if (isSignal(member)) {
          // `input()` / `input.required()`: writable-less signal → input only.
          if (!hasEntry(result.inputs, propName, propName)) {
            result.inputs.push({ propName, templateName: propName });
          }
        } else if (member instanceof OutputEmitterRef) {
          // `output()`: not a signal, exposes `subscribe` → output only.
          if (!hasEntry(result.outputs, propName, propName)) {
            result.outputs.push({ propName, templateName: propName });
          }
        }
      }
    }
  } catch {
    // The component may not be instantiable outside its real DI context (e.g. it
    // requires constructor dependencies). The primary path above already covers the
    // AOT runtime case; failing instantiation here is non-fatal and just means no
    // extra fallback-derived signal members are added.
  }

  return result;
};

export const isDeclarable = (component: any): boolean => {
  if (!component) {
    return false;
  }

  const decorators = reflectionCapabilities.annotations(component);

  return !!(decorators || []).find(
    (d) => d instanceof Directive || d instanceof Pipe || d instanceof Component
  );
};

export const isComponent = (component: any): component is Type<unknown> => {
  if (!component) {
    return false;
  }

  const decorators = reflectionCapabilities.annotations(component);

  return (decorators || []).some((d) => d instanceof Component);
};

export const isStandaloneComponent = (component: any): component is Type<unknown> => {
  if (!component) {
    return false;
  }

  const decorators = reflectionCapabilities.annotations(component);

  // TODO: `standalone` is only available in Angular v14. Remove cast to `any` once
  // Angular deps are updated to v14.x.x.
  return (decorators || []).some(
    (d) => (d instanceof Component || d instanceof Directive || d instanceof Pipe) && d.standalone
  );
};

/** Returns all component decorator properties is used to get all `@Input` and `@Output` Decorator */
export const getComponentPropsDecoratorMetadata = (component: any) => {
  return reflectionCapabilities.propMetadata(component);
};

/** Returns component decorator `@Component` */
export const getComponentDecoratorMetadata = (component: any): Component | undefined => {
  const decorators = reflectionCapabilities.annotations(component);

  return decorators.reverse().find((d) => d instanceof Component);
};
