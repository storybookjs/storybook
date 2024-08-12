import React from 'react';

import PropTypes, { shape, string } from 'prop-types';

import { PRESET_SHAPE, SOME_PROP_TYPES } from './ext';

const NAMED_OBJECT = {
  text: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

const ANOTHER_OBJECT = {
  foo: PropTypes.string,
  bar: PropTypes.string,
};

const NAMED_SHAPE = PropTypes.shape({
  foo: PropTypes.string,
});

export const POSITIONS = ['top-left', 'top-right', 'top-center'];

const FunctionalComponent = () => {
  return <div>FunctionalComponent!</div>;
};

class ClassComponent extends React.PureComponent {
  render() {
    return <div>ClassComponent!</div>;
  }
}

function concat(a, b) {
  return a + b;
}

function customPropType() {
  return null;
}

const nestedCustomPropType = {
  custom: customPropType,
};

const SOME_INLINE_PROP_TYPES = {
  /**
   * Hey Hey!
   */
  inlineString: PropTypes.string,
  inlineBool: PropTypes.bool,
  inlineNumber: PropTypes.number,
  inlineObj: PropTypes.shape({
    foo: PropTypes.string,
  }),
  inlineArray: PropTypes.arrayOf(PropTypes.number),
  inlineArrayOfObjects: PropTypes.arrayOf({ foo: PropTypes.string }),
  inlineFunctionalElement: PropTypes.element,
  inlineFunctionalElementInline: PropTypes.element,
  inlineFunctionalElementInlineReturningNull: PropTypes.element,
  inlineHtmlElement: PropTypes.element,
  inlineFunctionalElementInlineWithProps: PropTypes.element,
  inlineFunctionalElementNamedInline: PropTypes.element,
  inlineClassElement: PropTypes.element,
  inlineClassElementWithProps: PropTypes.element,
  inlineClassElementWithChildren: PropTypes.element,
  inlineClassElementInline: PropTypes.element,
  inlineFunc: PropTypes.func,
};

const SOME_INLINE_DEFAULT_PROPS = {
  inlineString: 'Inline prop default value',
  inlineBool: true,
  inlineNumber: 10,
  inlineObj: { foo: 'bar' },
  inlineArray: [1, 2, 3],
  inlineArrayOfObjects: [
    { foo: 'bar' },
    { foo: 'bar' },
    { foo: 'bar' },
    { foo: 'bar' },
    { foo: 'bar' },
  ],
  inlineFunctionalElement: <FunctionalComponent />,
  inlineFunctionalElementInline: () => {
    return <div>Inlined FunctionalComponent!</div>;
  },
  inlineFunctionalElementInlineReturningNull: () => {
    return null;
  },
  inlineHtmlElement: <div>Hey!</div>,
  inlineFunctionalElementInlineWithProps: ({ foo }) => {
    return <div>{foo}</div>;
  },
  inlineFunctionalElementNamedInline: function InlinedFunctionalComponent() {
    return <div>Inlined FunctionalComponent!</div>;
  },
  inlineClassElement: <ClassComponent />,
  inlineClassElementWithProps: <ClassComponent className="toto" />,
  inlineClassElementWithChildren: (
    <ClassComponent>
      <div>hey!</div>
    </ClassComponent>
  ),
  inlineClassElementInline: class InlinedClassComponent extends React.PureComponent {
    render() {
      return <div>Inlined ClassComponent!</div>;
    }
  },
  inlineFunc: function add(a, b) {
    return a + b;
  },
};

export const PropTypesProps = () => <div>PropTypes!</div>;

PropTypesProps.propTypes = {
  any: PropTypes.any,
  bool: PropTypes.bool,
  string: PropTypes.string,
  func: PropTypes.func,
  /**
   * A function with JSDoc tags.
   *
   * @param {string} foo - A foo value.
   * @param {number} bar - A bar value.
   * @returns {ComplexObject} - Returns a complex object.
   */
  funcWithJsDoc: PropTypes.func,
  /**
   * @param {string} foo - A foo value.
   * @param {number} bar - A bar value.
   * @param {number} bar1 - A bar value.
   * @param {number} bar2 - A bar value.
   * @param {number} bar3 - A bar value.
   * @param {number} bar4 - A bar value.
   * @param {number} bar5 - A bar value.
   * @returns {ComplexObject} - Returns a complex object.
   */
  semiLongFuncWithJsDoc: PropTypes.func,
  /**
   * @param {string} foo - A foo value.
   * @param {number} bar - A bar value.
   * @param {number} bar1 - A bar value.
   * @param {number} bar2 - A bar value.
   * @param {number} bar3 - A bar value.
   * @param {number} bar4 - A bar value.
   * @param {number} bar5 - A bar value.
   * @param {number} bar6 - A bar value.
   * @param {number} bar7 - A bar value.
   * @param {number} bar8 - A bar value.
   * @param {number} bar9 - A bar value.
   * @param {number} bar10 - A bar value.
   * @returns {ComplexObject} - Returns a complex object.
   */
  veryLongFuncWithJsDoc: PropTypes.func,
  namedDefaultFunc: PropTypes.func,
  number: PropTypes.number,
  /**
   * Plain object propType (use shape!!)
   */
  obj: PropTypes.object,
  symbol: PropTypes.symbol,
  node: PropTypes.node,
  useCustomPropType: customPropType,
  useNestedCustomPropType: nestedCustomPropType.custom,
  functionalElement: PropTypes.element,
  functionalElementInline: PropTypes.element,
  functionalElementNamedInline: PropTypes.element,
  classElement: PropTypes.element,
  classElementInline: PropTypes.element,
  functionalElementType: PropTypes.elementType,
  classElementType: PropTypes.elementType,
  elementWithProps: PropTypes.elementType,
  /**
   * `instanceOf` is also supported and the custom type will be shown instead of `instanceOf`
   */
  instanceOf: PropTypes.instanceOf(Set),
  /**
   * `oneOf` is basically an Enum which is also supported but can be pretty big.
   */
  oneOfString: PropTypes.oneOf(['News', 'Photos']),
  oneOfNumeric: PropTypes.oneOf([0, 1, 2, 3]),
  oneOfShapes: PropTypes.oneOf([
    PropTypes.shape({ foo: PropTypes.string }),
    PropTypes.shape({ bar: PropTypes.number }),
  ]),
  oneOfComplexShapes: PropTypes.oneOf([
    PropTypes.shape({
      /**
       *  Just an internal propType for a shape.
       *  It's also required, and as you can see it supports multi-line comments!
       */
      id: PropTypes.number.isRequired,
      /**
       *  A simple non-required function
       */
      func: PropTypes.func,
      /**
       * An `arrayOf` shape
       */
      arr: PropTypes.arrayOf(
        PropTypes.shape({
          /**
           * 5-level deep propType definition and still works.
           */
          index: PropTypes.number.isRequired,
        })
      ),
    }),
    shape({ bar: PropTypes.number }),
  ]),
  oneOfComplexType: PropTypes.oneOf([NAMED_OBJECT, ANOTHER_OBJECT]),
  oneOfComponents: PropTypes.oneOf([FunctionalComponent, ClassComponent]),
  oneOfEval: PropTypes.oneOf((() => ['News', 'Photos'])()),
  oneOfVar: PropTypes.oneOf(POSITIONS),
  oneOfNested: PropTypes.oneOf(['News', ['bottom-left', 'bottom-center', 'bottom-right']]),
  oneOfNestedSimpleInlineObject: PropTypes.oneOf(['News', [{ foo: PropTypes.string }]]),
  oneOfNestedComplexInlineObject: PropTypes.oneOf([
    'News',
    [{ nested: { foo: PropTypes.string } }],
  ]),
  oneOfNestedComplexShape: PropTypes.oneOf([
    'News',
    [{ nested: PropTypes.shape({ foo: PropTypes.string }) }],
  ]),
  /**
   *  A multi-type prop is also valid and is displayed as `Union<String|Message>`
   */
  oneOfType: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Set)]),
  /**
   * array of a primitive type
   */
  arrayOfPrimitive: PropTypes.arrayOf(PropTypes.number),
  arrayOfNamedObject: PropTypes.arrayOf(NAMED_OBJECT),
  arrayOfShortInlineObject: PropTypes.arrayOf({
    foo: PropTypes.string,
  }),
  arrayOfInlineObject: PropTypes.arrayOf({
    text: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  }),
  arrayOfComplexInlineObject: PropTypes.arrayOf({
    text: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    shape: {
      id: PropTypes.string.isRequired,
      age: PropTypes.number.isRequired,
    },
  }),
  arrayOfShortShape: PropTypes.arrayOf(
    PropTypes.shape({
      bar: PropTypes.string,
    })
  ),
  arrayOfComplexShape: PropTypes.arrayOf(
    PropTypes.shape({
      /**
       *  Just an internal propType for a shape.
       *  It's also required, and as you can see it supports multi-line comments!
       */
      id: PropTypes.number.isRequired,
      /**
       *  A simple non-required function
       */
      func: PropTypes.func,
      /**
       * An `arrayOf` shape
       */
      arr: PropTypes.arrayOf(
        PropTypes.shape({
          /**
           * 5-level deep propType definition and still works.
           */
          index: PropTypes.number.isRequired,
        })
      ),
    })
  ),
  arrayExternalShape: PropTypes.arrayOf(PropTypes.shape(PRESET_SHAPE)),
  /**
   *  A simple `objectOf` propType.
   */
  simpleObjectOf: PropTypes.objectOf(PropTypes.number),
  objectOfShortInlineObject: PropTypes.objectOf({
    foo: PropTypes.string,
  }),
  objectOfInlineObject: PropTypes.objectOf({
    foo: PropTypes.string,
    bar: PropTypes.string,
    barry: PropTypes.string,
  }),
  objectOfShortShape: PropTypes.objectOf(
    PropTypes.shape({
      foo: string,
    })
  ),
  /**
   *  A very complex `objectOf` propType.
   */
  objectOfComplexShape: PropTypes.objectOf(
    PropTypes.shape({
      /**
       *  Just an internal propType for a shape.
       *  It's also required, and as you can see it supports multi-line comments!
       */
      id: PropTypes.number.isRequired,
      /**
       *  A simple non-required function
       */
      func: PropTypes.func,
      /**
       * An `arrayOf` shape
       */
      arr: PropTypes.arrayOf(
        PropTypes.shape({
          /**
           * 5-level deep propType definition and still works.
           */
          index: PropTypes.number.isRequired,
        })
      ),
    })
  ),
  namedObjectOf: PropTypes.objectOf(NAMED_OBJECT),
  shapeShort: PropTypes.shape({
    foo: string,
  }),
  shapeLong: PropTypes.shape({
    foo: string,
    prop1: string,
    prop2: string,
    prop3: string,
    prop4: string,
    prop5: string,
    prop6: string,
    prop7: string,
  }),
  /**
   * propType for shape with nested arrayOf
   *
   * Also, multi-line description
   */
  shapeComplex: PropTypes.shape({
    /**
     *  Just an internal propType for a shape.
     *  It's also required, and as you can see it supports multi-line comments!
     */
    id: PropTypes.number.isRequired,
    /**
     *  A simple non-required function
     */
    func: PropTypes.func,
    /**
     * An `arrayOf` shape
     */
    arr: PropTypes.arrayOf(
      PropTypes.shape({
        /**
         * 5-level deep propType definition and still works.
         */
        index: PropTypes.number.isRequired,
      })
    ),
    shape: PropTypes.shape({
      shape: PropTypes.shape({
        foo: PropTypes.string,
        oneOf: PropTypes.oneOf(['one', 'two']),
      }),
    }),
    oneOf: PropTypes.oneOf(['one', 'two']),
  }),
  shapeWithArray: PropTypes.shape({
    arr: PropTypes.arrayOf({ foo: PropTypes.string }),
  }),
  namedShape: NAMED_SHAPE,
  namedObjectInShape: PropTypes.shape(NAMED_OBJECT),
  exact: PropTypes.exact({
    name: PropTypes.string,
    quantity: PropTypes.number,
  }),
  namedExact: PropTypes.exact(NAMED_OBJECT),
  /**
   * test string with a comment that has
   * two identical lines
   * two identical lines
   */
  optionalString: PropTypes.string,
  requiredString: PropTypes.string.isRequired,
  nullDefaultValue: PropTypes.string,
  undefinedDefaultValue: PropTypes.string,
  ...SOME_INLINE_PROP_TYPES,
  ...SOME_PROP_TYPES,
};

PropTypesProps.defaultProps = {
  any: 'Default any',
  bool: false,
  string: 'Default string',
  func: () => {},
  funcWithJsDoc: (foo, bar) => {
    const yo = window.document;

    return { foo, bar };
  },
  namedDefaultFunc: concat,
  number: 5,
  obj: {
    key: 'value',
  },
  symbol: Symbol('Default symbol'),
  node: <div>Hello!</div>,
  functionalElement: <FunctionalComponent className="toto" />,
  functionalElementInline: () => {
    return <div>Inlined FunctionalComponent!</div>;
  },
  functionalElementNamedInline: function InlinedFunctionalComponent() {
    return <div>Inlined FunctionalComponent!</div>;
  },
  classElement: <ClassComponent />,
  classElementInline: class InlinedClassComponent extends React.PureComponent {
    render() {
      return <div>Inlined ClassComponent!</div>;
    }
  },
  functionalElementType: FunctionalComponent,
  classElementType: ClassComponent,
  elementWithProps: <ClassComponent className="w8 h8 fill-marine-500" />,
  instanceOf: new Set(),
  oneOfString: 'News',
  oneOfNumeric: 1,
  oneOfShapes: { foo: 'bar' },
  oneOfComplexShapes: {
    thing: {
      id: 2,
      func: () => {},
      arr: [],
    },
  },
  oneOfComplexType: { text: 'foo', value: 'bar' },
  oneOfComponents: <FunctionalComponent />,
  oneOfEval: 'Photos',
  oneOfVar: 'top-right',
  oneOfNested: 'top-right',
  oneOfType: 'hello',
  arrayOfPrimitive: [1, 2, 3],
  arrayOfString: ['0px', '0px'],
  arrayOfNamedObject: [{ text: 'foo', value: 'bar' }],
  arrayOfShortInlineObject: [{ foo: 'bar' }],
  arrayOfInlineObject: [{ text: 'foo', value: 'bar' }],
  arrayOfComplexInlineObject: [{ text: 'foo', value: 'bar' }],
  arrayOfShortShape: [{ bar: 'foo' }],
  arrayOfComplexShape: [
    {
      thing: {
        id: 2,
        func: () => {},
        arr: [],
      },
    },
  ],
  simpleObjectOf: { key: 1 },
  objectOfShortInlineObject: { foo: 'bar' },
  objectOfInlineObject: { foo: 'bar', bar: 'foo' },
  objectOfShortShape: { foo: 'bar' },
  objectOfComplexShape: {
    thing: {
      id: 2,
      func: () => {},
      arr: [],
    },
  },
  namedObjectOf: { text: 'foo', value: 'bar' },
  shapeShort: { foo: 'bar' },
  shapeComplex: {
    id: 3,
    func: () => {},
    arr: [],
    shape: {
      shape: {
        foo: 'bar',
      },
    },
  },
  namedShape: { foo: 'bar' },
  namedObjectInShape: { text: 'foo', value: 'bar' },
  exact: { name: 'foo', quantity: 2 },
  namedExact: { text: 'foo', value: 'bar' },
  optionalString: 'Default String',
  nullDefaultValue: null,
  undefinedDefaultValue: undefined,
  ...SOME_INLINE_DEFAULT_PROPS,
};

export const component = PropTypesProps;
