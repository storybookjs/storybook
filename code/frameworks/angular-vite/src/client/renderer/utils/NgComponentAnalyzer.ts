import type { Type } from '@angular/core';
import {
  Component,
  Directive,
  Input,
  Output,
  Pipe,
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

  // Add signal-based I/O, which the decorator path above cannot see.
  return addSignalInputsOutputs(component, decoratorDerived);
};

const hasEntry = (
  list: { propName: string; templateName: string }[],
  propName: string,
  templateName: string
) => list.some((e) => e.propName === propName || e.templateName === templateName);

/**
 * `model()`/`input()`/`output()` are decorator-less, so they never appear in
 * `ɵReflectionCapabilities.propMetadata`. They are read instead from the compiled
 * component definition (`ɵcmp`), which Storybook always receives from the Angular
 * builder and which already encodes resolved binding names (aliased
 * `model(x, { alias })` and `model.required()` included). Purely static — never
 * instantiates the component. Results are additive and de-duplicated against
 * `base`, so decorator-based I/O is unchanged.
 */
const addSignalInputsOutputs = (
  component: any,
  base: ComponentInputsOutputs
): ComponentInputsOutputs => {
  const result: ComponentInputsOutputs = {
    inputs: [...base.inputs],
    outputs: [...base.outputs],
  };

  let def: any;
  try {
    def = getComponentDef(component);
  } catch {
    // `ɵgetComponentDef` may be unavailable for non-component classes.
    return result;
  }
  if (!def) {
    return result;
  }

  // `ɵcmp` keys the I/O maps by template (binding) name, not property name:
  //   def.inputs:  { [templateName]: propName | [propName, flags, transform] }
  //   def.outputs: { [templateName]: propName }
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
