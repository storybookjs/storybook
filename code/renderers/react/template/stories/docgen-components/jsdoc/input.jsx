import React from 'react';

import PropTypes from 'prop-types';

const JsDocProps = () => <div>JSDoc with PropTypes!</div>;
JsDocProps.propTypes = {
  /**
   * Should not be visible since it's ignored.
   *
   * @ignore
   */
  case0: PropTypes.string,
  /** Simple description. */
  case1: PropTypes.string,
  /** Multi lines description */
  case2: PropTypes.string,
  /** _description_ **with** `formatting` */
  case3: PropTypes.string,
  /**
   * Simple description and dummy JSDoc tag.
   *
   * @param event
   */
  case4: PropTypes.string,
  /** @param event */
  case5: PropTypes.string,
  /** Simple description with a @. */
  case6: PropTypes.string,
  case7: PropTypes.func,
  /** Func with a simple description. */
  case8: PropTypes.func,
  /** @param event */
  case9: PropTypes.func,
  /**
   * Param with name
   *
   * @param event
   */
  case10: PropTypes.func,
  /**
   * Param with name & type
   *
   * @param {SyntheticEvent} event
   */
  case11: PropTypes.func,
  /**
   * Param with name, type & description
   *
   * @param {SyntheticEvent} event - React's original event
   */
  case12: PropTypes.func,
  /**
   * Param with type
   *
   * @param {SyntheticEvent}
   */
  case13: PropTypes.func,
  /**
   * Param with type & description
   *
   * @param {SyntheticEvent} - React's original event
   */
  case14: PropTypes.func,
  /**
   * Param with name & description
   *
   * @param event - React's original event
   */
  case15: PropTypes.func,
  /**
   * Autofix event-
   *
   * @param event- React's original event
   */
  case16: PropTypes.func,
  /**
   * Autofix event.
   *
   * @param event.
   * @returns {string}
   */
  case17: PropTypes.func,
  /**
   * With an empty param.
   *
   * @param
   */
  case18: PropTypes.func,
  /**
   * With multiple empty params.
   *
   * @param
   * @param
   * @param
   */
  case19: PropTypes.func,
  /**
   * With arg alias.
   *
   * @param event
   */
  case20: PropTypes.func,
  /**
   * With argument alias.
   *
   * @param event
   */
  case21: PropTypes.func,
  /**
   * With multiple params.
   *
   * @param {SyntheticEvent} event
   * @param {string} stringValue
   * @param {number} numberValue
   */
  case22: PropTypes.func,
  /**
   * With an empty returns
   *
   * @returns
   */
  case23: PropTypes.func,
  /**
   * With a returns with a type
   *
   * @returns {SyntheticEvent}
   */
  case24: PropTypes.func,
  /**
   * With a returns with a type & description
   *
   * @returns {SyntheticEvent} - React's original event
   */
  case25: PropTypes.func,
  /**
   * Single param and a returns
   *
   * @param {string} stringValue
   * @returns {SyntheticEvent} - React's original event
   */
  case26: PropTypes.func,
  /**
   * Multiple params and a returns
   *
   * @param {string} stringValue
   * @param {number} numberValue
   * @returns {SyntheticEvent} - React's original event
   */
  case27: PropTypes.func,
  /**
   * Multiple returns
   *
   * @returns {SyntheticEvent} - React's original event
   * @returns {string} - Second returns
   */
  case28: PropTypes.func,
  /**
   * Param with unsupported JSDoc tags
   *
   * @version 2
   * @type {number}
   * @param {SyntheticEvent} event - React's original event
   */
  case29: PropTypes.func,
  /**
   * Param record type
   *
   * @param {{ a: number; b: string }} myType
   */
  case30: PropTypes.func,
  /**
   * Param array type
   *
   * @param {string[]} myType
   */
  case31: PropTypes.func,
  /**
   * Param union type
   *
   * @param {number | boolean} myType
   */
  case32: PropTypes.func,
  /**
   * Param any type
   *
   * @param {any} myType
   */
  case33: PropTypes.func,
  /**
   * Param repeatable type
   *
   * @param {...number} myType
   */
  case34: PropTypes.func,
  /**
   * Optional param
   *
   * @param {number} [myType]
   */
  case35: PropTypes.func,
  /**
   * Optional param
   *
   * @param {number} [myType]
   */
  case36: PropTypes.func,
  /**
   * Dot in param name
   *
   * @param {number} my.type
   */
  case37: PropTypes.func,
  /**
   * Returns record type
   *
   * @returns {{ a: number; b: string }}
   */
  case38: PropTypes.func,
  /**
   * Returns array type
   *
   * @returns {string[]}
   */
  case39: PropTypes.func,
  /**
   * Returns union type
   *
   * @returns {number | boolean}
   */
  case40: PropTypes.func,
  /**
   * Returns any type
   *
   * @returns {any}
   */
  case41: PropTypes.func,
  /**
   * Returns primitive
   *
   * @returns {string}
   */
  case42: PropTypes.func,
  /**
   * Returns void
   *
   * @returns {void}
   */
  case43: PropTypes.func,
};

export const component = JsDocProps;
