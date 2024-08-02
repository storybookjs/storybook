/* eslint-disable no-underscore-dangle */
import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import { addons } from 'storybook/internal/preview-api';
import type { VNode } from 'vue';
import { isVNode, watch } from 'vue';
import type { Args, Decorator, StoryContext } from '../public-types';

/**
 * Context that is passed down to nested components/slots when generating the source code for a single story.
 */
export type SourceCodeGeneratorContext = {
  /**
   * Properties/variables that should be placed inside a `<script lang="ts" setup>` block.
   * Usually contains complex property values like objects and arrays.
   */
  scriptVariables: Record<string, string>;
  /**
   * Optional imports to add inside the `<script lang="ts" setup>` block.
   * e.g. to add 'import { ref } from "vue";'
   *
   * key = package name, values = imports
   */
  imports: Record<string, Set<string>>;
};

/**
 * Decorator to generate Vue source code for stories.
 */
export const sourceDecorator: Decorator = (storyFn, ctx) => {
  const story = storyFn();
  if (shouldSkipSourceCodeGeneration(ctx)) return story;

  const channel = addons.getChannel();

  watch(
    () => ctx.args,
    () => {
      const sourceCode = generateSourceCode(ctx);

      channel.emit(SNIPPET_RENDERED, {
        id: ctx.id,
        args: ctx.args,
        source: sourceCode,
        format: 'vue',
      });
    },
    { immediate: true, deep: true }
  );

  return story;
};

/**
 * Generate Vue source code for the given Story.
 * @returns Source code or empty string if source code could not be generated.
 */
export const generateSourceCode = (
  ctx: Pick<StoryContext, 'title' | 'component' | 'args'> & {
    component?: StoryContext['component'] & { __docgenInfo?: unknown };
  }
): string => {
  const sourceCodeContext: SourceCodeGeneratorContext = {
    imports: {},
    scriptVariables: {},
  };

  const { displayName, slotNames, eventNames } = parseDocgenInfo(ctx.component);

  const props = generatePropsSourceCode(ctx.args, slotNames, eventNames, sourceCodeContext);
  const slotSourceCode = generateSlotSourceCode(ctx.args, slotNames, sourceCodeContext);
  const componentName = displayName || ctx.title.split('/').at(-1)!;

  // prefer self closing tag if no slot content exists
  const templateCode = slotSourceCode
    ? `<${componentName} ${props}> ${slotSourceCode} </${componentName}>`
    : `<${componentName} ${props} />`;

  const variablesCode = Object.entries(sourceCodeContext.scriptVariables)
    .map(([name, value]) => `const ${name} = ${value};`)
    .join('\n\n');

  const importsCode = Object.entries(sourceCodeContext.imports)
    .map(([packageName, imports]) => {
      return `import { ${Array.from(imports.values()).sort().join(', ')} } from "${packageName}";`;
    })
    .join('\n');

  const template = `<template>\n  ${templateCode}\n</template>`;

  if (!importsCode && !variablesCode) return template;

  return `<script lang="ts" setup>
${importsCode ? `${importsCode}\n\n${variablesCode}` : variablesCode}
</script>

${template}`;
};

/**
 * Checks if the source code generation should be skipped for the given Story context.
 * Will be true if one of the following is true:
 * - view mode is not "docs"
 * - story is no arg story
 * - story has set custom source code via parameters.docs.source.code
 * - story has set source type to "code" via parameters.docs.source.type
 */
export const shouldSkipSourceCodeGeneration = (context: StoryContext): boolean => {
  const sourceParams = context?.parameters.docs?.source;
  if (sourceParams?.type === SourceType.DYNAMIC) {
    // always render if the user forces it
    return false;
  }

  const isArgsStory = context?.parameters.__isArgsStory;
  const isDocsViewMode = context?.viewMode === 'docs';

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return (
    !isDocsViewMode || !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE
  );
};

/**
 * Parses the __docgenInfo of the given component.
 * Requires Storybook docs addon to be enabled.
 * Default slot will always be sorted first, remaining slots are sorted alphabetically.
 */
export const parseDocgenInfo = (
  component?: StoryContext['component'] & { __docgenInfo?: unknown }
) => {
  // type check __docgenInfo to prevent errors
  if (
    !component ||
    !('__docgenInfo' in component) ||
    !component.__docgenInfo ||
    typeof component.__docgenInfo !== 'object'
  ) {
    return {
      displayName: component?.__name,
      eventNames: [],
      slotNames: [],
    };
  }

  const docgenInfo = component.__docgenInfo as Record<string, unknown>;

  const displayName =
    'displayName' in docgenInfo && typeof docgenInfo.displayName === 'string'
      ? docgenInfo.displayName
      : undefined;

  const parseNames = (key: 'slots' | 'events') => {
    if (!(key in docgenInfo) || !Array.isArray(docgenInfo[key])) return [];

    const values = docgenInfo[key] as unknown[];

    return values
      .map((i) => (i && typeof i === 'object' && 'name' in i ? i.name : undefined))
      .filter((i): i is string => typeof i === 'string');
  };

  return {
    displayName: displayName || component.__name,
    slotNames: parseNames('slots').sort((a, b) => {
      if (a === 'default') return -1;
      if (b === 'default') return 1;
      return a.localeCompare(b);
    }),
    eventNames: parseNames('events'),
  };
};

/**
 * Generates the source code for the given Vue component properties.
 * Props with complex values (objects and arrays) and v-models will be added to the ctx.scriptVariables because they should be
 * generated in a `<script lang="ts" setup>` block.
 *
 * @param args Story args / property values.
 * @param slotNames All slot names of the component. Needed to not generate code for args that are slots.
 * Can be extracted using `parseDocgenInfo()`.
 * @param eventNames All event names of the component. Needed to generate v-model properties. Can be extracted using `parseDocgenInfo()`.
 *
 * @example `:a="42" b="Hello World" v-model="modelValue" v-model:search="search"`
 */
export const generatePropsSourceCode = (
  args: Record<string, unknown>,
  slotNames: string[],
  eventNames: string[],
  ctx: SourceCodeGeneratorContext
) => {
  type Property = {
    /** Property name */
    name: string;
    /** Stringified property value */
    value: string;
    /**
     * Function that returns the source code when used inside the `<template>`.
     * If unset, the property will be generated inside the `<script lang="ts" setup>` block.
     */
    templateFn?: (name: string, value: string) => string;
  };

  const properties: Property[] = [];

  Object.entries(args).forEach(([propName, value]) => {
    // ignore slots
    if (slotNames.includes(propName)) return;
    if (value == undefined) return; // do not render undefined/null values

    switch (typeof value) {
      case 'string':
        if (value === '') return; // do not render empty strings

        properties.push({
          name: propName,
          value: value.includes('"') ? `'${value}'` : `"${value}"`,
          templateFn: (name, propValue) => `${name}=${propValue}`,
        });
        break;
      case 'number':
        properties.push({
          name: propName,
          value: value.toString(),
          templateFn: (name, propValue) => `:${name}="${propValue}"`,
        });
        break;
      case 'bigint':
        properties.push({
          name: propName,
          value: `BigInt(${value.toString()})`,
          templateFn: (name, propValue) => `:${name}="${propValue}"`,
        });
        break;
      case 'boolean':
        properties.push({
          name: propName,
          value: value ? 'true' : 'false',
          templateFn: (name, propValue) => (propValue === 'true' ? name : `:${name}="false"`),
        });
        break;
      case 'symbol':
        properties.push({
          name: propName,
          value: `Symbol(${value.description ? `'${value.description}'` : ''})`,
          templateFn: (name, propValue) => `:${name}="${propValue}"`,
        });
        break;
      case 'object': {
        properties.push({
          name: propName,
          value: formatObject(value),
          // to follow Vue best practices, complex values like object and arrays are
          // usually placed inside the <script setup> block instead of inlining them in the <template>
          templateFn: undefined,
        });
        break;
      }
      case 'function':
        // TODO: check if functions should be rendered in source code
        break;
    }
  });

  properties.sort((a, b) => a.name.localeCompare(b.name));

  /**
   * List of generated source code for the props.
   * @example [':a="42"', 'b="Hello World"']
   */
  const props: string[] = [];

  // now that we have all props parsed, we will generate them either inside the `<script lang="ts" setup>` block
  // or inside the `<template>`.
  // we also make sure to render v-model properties accordingly (see https://vuejs.org/guide/components/v-model)
  properties.forEach((prop) => {
    const isVModel = eventNames.includes(`update:${prop.name}`);

    if (!isVModel && prop.templateFn) {
      props.push(prop.templateFn(prop.name, prop.value));
      return;
    }

    let variableName = prop.name;

    // a variable with the same name might already exist (e.g. from a parent component)
    // so we need to make sure to use a unique name here to not generate multiple variables with the same name
    if (variableName in ctx.scriptVariables) {
      let index = 1;
      do {
        variableName = `${prop.name}${index}`;
        index++;
      } while (variableName in ctx.scriptVariables);
    }

    if (!isVModel) {
      ctx.scriptVariables[variableName] = prop.value;
      props.push(`:${prop.name}="${variableName}"`);
      return;
    }

    // always generate v-models inside the `<script lang="ts" setup>` block
    ctx.scriptVariables[variableName] = `ref(${prop.value})`;

    if (!ctx.imports.vue) ctx.imports.vue = new Set();
    ctx.imports.vue.add('ref');

    if (prop.name === 'modelValue') {
      props.push(`v-model="${variableName}"`);
    } else {
      props.push(`v-model:${prop.name}="${variableName}"`);
    }
  });

  return props.join(' ');
};

/**
 * Generates the source code for the given Vue component slots.
 * Supports primitive slot content (e.g. strings, numbers etc.) and nested components/VNodes (e.g. created using Vue's `h()` function).
 *
 * @param args Story args.
 * @param slotNames All slot names of the component. Needed to only generate slots and ignore props etc.
 * Can be extracted using `parseDocgenInfo()`.
 * @param ctx Context so complex props of nested slot children will be set in the ctx.scriptVariables.
 *
 * @example `<template #slotName="{ foo }">Content {{ foo }}</template>`
 */
export const generateSlotSourceCode = (
  args: Args,
  slotNames: string[],
  ctx: SourceCodeGeneratorContext
): string => {
  /** List of slot source codes (e.g. <template #slotName>Content</template>) */
  const slotSourceCodes: string[] = [];

  slotNames.forEach((slotName) => {
    const arg = args[slotName];
    if (!arg) return;

    const slotContent = generateSlotChildrenSourceCode([arg], ctx);
    if (!slotContent) return; // do not generate source code for empty slots

    const slotBindings = typeof arg === 'function' ? getFunctionParamNames(arg) : [];

    if (slotName === 'default' && !slotBindings.length) {
      // do not add unnecessary "<template #default>" tag since the default slot content without bindings
      // can be put directly into the slot without need of "<template #default>"
      slotSourceCodes.push(slotContent);
    } else {
      slotSourceCodes.push(
        `<template ${slotBindingsToString(slotName, slotBindings)}>${slotContent}</template>`
      );
    }
  });

  return slotSourceCodes.join('\n\n');
};

/**
 * Generates the source code for the given slot children (the code inside <template #slotName></template>).
 */
const generateSlotChildrenSourceCode = (
  children: unknown[],
  ctx: SourceCodeGeneratorContext
): string => {
  const slotChildrenSourceCodes: string[] = [];

  /**
   * Recursively generates the source code for a single slot child and all its children.
   * @returns Source code for child and all nested children or empty string if child is of a non-supported type.
   */
  const generateSingleChildSourceCode = (child: unknown): string => {
    if (isVNode(child)) {
      return generateVNodeSourceCode(child, ctx);
    }

    switch (typeof child) {
      case 'string':
      case 'number':
      case 'boolean':
        return child.toString();

      case 'object':
        if (child === null) return '';
        if (Array.isArray(child)) {
          // if child also has children, we generate them recursively
          return child
            .map(generateSingleChildSourceCode)
            .filter((code) => code !== '')
            .join('\n');
        }
        return JSON.stringify(child);

      case 'function': {
        const paramNames = getFunctionParamNames(child).filter(
          (param) => !['{', '}'].includes(param)
        );

        const parameters = paramNames.reduce<Record<string, string>>((obj, param) => {
          obj[param] = `{{ ${param} }}`;
          return obj;
        }, {});

        const returnValue = child(parameters);
        let slotSourceCode = generateSlotChildrenSourceCode([returnValue], ctx);

        // if slot bindings are used for properties of other components, our {{ paramName }} is incorrect because
        // it would generate e.g. my-prop="{{ paramName }}", therefore, we replace it here to e.g. :my-prop="paramName"
        paramNames.forEach((param) => {
          slotSourceCode = slotSourceCode.replaceAll(
            new RegExp(` (\\S+)="{{ ${param} }}"`, 'g'),
            ` :$1="${param}"`
          );
        });

        return slotSourceCode;
      }

      case 'bigint':
        return `{{ BigInt(${child.toString()}) }}`;

      // the only missing case here is "symbol"
      // because rendering a symbol as slot / HTML does not make sense and is not supported by Vue
      default:
        return '';
    }
  };

  children.forEach((child) => {
    const sourceCode = generateSingleChildSourceCode(child);
    if (sourceCode !== '') slotChildrenSourceCodes.push(sourceCode);
  });

  return slotChildrenSourceCodes.join('\n');
};

/**
 * Generates source code for the given VNode and all its children (e.g. created using `h(MyComponent)` or `h("div")`).
 */
const generateVNodeSourceCode = (vnode: VNode, ctx: SourceCodeGeneratorContext): string => {
  const componentName = getVNodeName(vnode);
  let childrenCode = '';

  if (typeof vnode.children === 'string') {
    childrenCode = vnode.children;
  } else if (Array.isArray(vnode.children)) {
    childrenCode = generateSlotChildrenSourceCode(vnode.children, ctx);
  } else if (vnode.children) {
    // children are an object, just like if regular Story args where used
    // so we can generate the source code with the regular "generateSlotSourceCode()".
    childrenCode = generateSlotSourceCode(
      vnode.children,
      // $stable is a default property in vnode.children so we need to filter it out
      // to not generate source code for it
      Object.keys(vnode.children).filter((i) => i !== '$stable'),
      ctx
    );
  }

  const props = vnode.props ? generatePropsSourceCode(vnode.props, [], [], ctx) : '';

  // prefer self closing tag if no children exist
  if (childrenCode) {
    return `<${componentName}${props ? ` ${props}` : ''}>${childrenCode}</${componentName}>`;
  }
  return `<${componentName}${props ? ` ${props}` : ''} />`;
};

/**
 * Gets the name for the given VNode.
 * Will return "component" if name could not be extracted.
 *
 * @example "div" for `h("div")` or "MyComponent" for `h(MyComponent)`
 */
const getVNodeName = (vnode: VNode) => {
  // this is e.g. the case when rendering native HTML elements like, h("div")
  if (typeof vnode.type === 'string') return vnode.type;

  if (typeof vnode.type === 'object') {
    // this is the case when using custom Vue components like h(MyComponent)
    if ('name' in vnode.type && vnode.type.name) {
      // prefer custom component name set by the developer
      return vnode.type.name;
    } else if ('__name' in vnode.type && vnode.type.__name) {
      // otherwise use name inferred by Vue from the file name
      return vnode.type.__name;
    }
  }

  return 'component';
};

/**
 * Gets a list of parameters for the given function since func.arguments can not be used since
 * it throws a TypeError.
 *
 * If the arguments are destructured (e.g. "func({ foo, bar })"), the returned array will also
 * include "{" and "}".
 *
 * @see Based on https://stackoverflow.com/a/9924463
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const getFunctionParamNames = (func: Function): string[] => {
  const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
  const ARGUMENT_NAMES = /([^\s,]+)/g;

  const fnStr = func.toString().replace(STRIP_COMMENTS, '');
  const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if (!result) return [];

  // when running "storybook build", the function will be minified, so result for e.g.
  // `({ foo, bar }) => { // function body }` will be `["{foo:e", "bar:a}"]`
  // therefore we need to remove the :e and :a mappings and extract the "{" and "}"" from the destructured object
  // so the final result becomes `["{", "foo", "bar", "}"]`
  return result.flatMap((param) => {
    if (['{', '}'].includes(param)) return param;
    const nonMinifiedName = param.split(':')[0].trim();
    if (nonMinifiedName.startsWith('{')) {
      return ['{', nonMinifiedName.substring(1)];
    }
    if (param.endsWith('}') && !nonMinifiedName.endsWith('}')) {
      return [nonMinifiedName, '}'];
    }
    return nonMinifiedName;
  });
};

/**
 * Converts the given slot bindings/parameters to a string.
 *
 * @example
 * If no params: '#slotName'
 * If params: '#slotName="{ foo, bar }"'
 */
const slotBindingsToString = (
  slotName: string,
  params: string[]
): `#${string}` | `#${string}="${string}"` => {
  if (!params.length) return `#${slotName}`;
  if (params.length === 1) return `#${slotName}="${params[0]}"`;

  // parameters might be destructured so remove duplicated brackets here
  return `#${slotName}="{ ${params.filter((i) => !['{', '}'].includes(i)).join(', ')} }"`;
};

/**
 * Formats the given object as string.
 * Will format in single line if it only contains non-object values.
 * Otherwise will format multiline.
 */
export const formatObject = (obj: object): string => {
  const isPrimitive = Object.values(obj).every(
    (value) => value == null || typeof value !== 'object'
  );

  // if object/array only contains non-object values, we format all values in one line
  if (isPrimitive) return JSON.stringify(obj);

  // otherwise, we use a "pretty" formatting with newlines and spaces
  return JSON.stringify(obj, null, 2);
};
