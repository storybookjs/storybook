import {
  formatPropInTemplate,
  createAngularInputProperty,
} from './angular-beta/ComputesTemplateFromComponent';

/**
 * Options for controlling the behavior of the argsToTemplate function.
 *
 * @template T The type of the keys in the target object.
 */
export interface ArgsToTemplateOptions<T> {
  /**
   * An array of keys to specifically include in the output. If provided, only the keys from this
   * array will be included in the output, irrespective of the `exclude` option. Undefined values
   * will still be excluded from the output.
   */
  include?: Array<T>;
  /**
   * An array of keys to specifically exclude from the output. If provided, these keys will be
   * omitted from the output. This option is ignored if the `include` option is also provided
   */
  exclude?: Array<T>;
  /** Toggle between showing current value or variable name for template bindings. */
  useVariableNames?: boolean;
  /** Toggle between sorting properties by name */
  sort?: boolean;
  /** Object of key:value pairs. When values are set to default the bindings will not appear. */
  defaultValues?: { [key: string]: any };
}

/**
 * Converts an object of arguments to a string of property and event bindings and excludes undefined
 * values. Why? Because Angular treats undefined values in property bindings as an actual value and
 * does not apply the default value of the property as soon as the binding is set. This feels
 * counter-intuitive and is a common source of bugs in stories.
 *
 * @example
 *
 * ```ts
 * // component.ts
 * ㅤ@Component({ selector: 'example' })
 *  export class ExampleComponent {
 *   ㅤ@Input() input1: string = 'Default Input1';
 *   ㅤ@Input() input2: string = 'Default Input2';
 *   ㅤ@Output() click = new EventEmitter();
 *  }
 *
 * // component.stories.ts
 * import { argsToTemplate } from '@storybook/angular';
 * export const Input1: Story = {
 *  render: (args) => ({
 *    props: args,
 *    // Problem1: <example [input1]="input1" [input2]="input2" (click)="click($event)"></example>
 *    // This will set input2 to undefined and the internal default value will not be used.
 *    // Problem2: <example [input1]="input1" (click)="click($event)"></example>
 *    // The default value of input2 will be used, but it is not overridable by the user via controls.
 *    // Solution: Now the controls will be applicable to both input1 and input2, and the default values will be used if the user does not override them.
 *    template: `<example ${argsToTemplate(args)}"></example>`,
 *  }),
 *  args: {
 *    // In this Story, we want to set the input1 property, and the internal default property of input2 should be used.
 *    input1: 'Input 1',
 *    click: { action: 'clicked' },
 *  },
 * };
 * ```
 */
export function argsToTemplate<A extends Record<string, any>>(
  args: A,
  options: ArgsToTemplateOptions<keyof A> = {}
) {
  const includeSet = options.include ? new Set(options.include) : null;
  const excludeSet = options.exclude ? new Set(options.exclude) : null;
  const defaultValues = { ...options.defaultValues };

  return Object.entries(args)
    .filter(
      ([key]) =>
        args[key] !== undefined && (options.useVariableNames || args[key] !== defaultValues[key])
    )
    .filter(([key]) => {
      if (includeSet) return includeSet.has(key);
      if (excludeSet) return !excludeSet.has(key);
      return true;
    })
    .sort((a, b) => {
      const aIsFn = typeof a[1] === 'function';
      const bIsFn = typeof b[1] === 'function';
      if (aIsFn && !bIsFn) return 1;
      if (!aIsFn && bIsFn) return -1;
      return options.sort ? a[0].localeCompare(b[0]) : 0;
    })
    .map(([key, value]) =>
      typeof value === 'function'
        ? `(${key})="${formatPropInTemplate(key)}($event)"`
        : options.useVariableNames
          ? `[${key}]="${formatPropInTemplate(key)}"`
          : createAngularInputProperty({ propertyName: key, value: args[key] })
    )
    .join(' ');
}
