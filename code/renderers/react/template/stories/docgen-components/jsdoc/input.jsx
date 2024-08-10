import React from 'react';

import PropTypes from 'prop-types';

const JsDocProps = () => <div>JSDoc with PropTypes!</div>;
JsDocProps.propTypes = {
  /**
   * should not be visible since it's ignored.
   * @ignore
   */
  case0: PropTypes.string,
  /**
   * simple description.
   */
  case1: PropTypes.string,
  /**
   * multi
   * lines
   * description
   */
  case2: PropTypes.string,
  /**
   * *description* **with** `formatting`
   */
  case3: PropTypes.string,
  /**
   * simple description and dummy JSDoc tag.
   * @param event
   */
  case4: PropTypes.string,
  /**
   * @param event
   */
  case5: PropTypes.string,
  /**
   * simple description with a @.
   */
  case6: PropTypes.string,
  case7: PropTypes.func,
  /**
   * func with a simple description.
   */
  case8: PropTypes.func,
  /**
   * @param event
   */
  case9: PropTypes.func,
  /**
   * param with name
   * @param event
   */
  case10: PropTypes.func,
  /**
   * param with name & type
   * @param {SyntheticEvent} event
   */
  case11: PropTypes.func,
  /**
   * param with name, type & description
   * @param {SyntheticEvent} event - React's original event
   */
  case12: PropTypes.func,
  /**
   * param with type
   * @param {SyntheticEvent}
   */
  case13: PropTypes.func,
  /**
   * param with type & description
   * @param {SyntheticEvent} - React's original event
   */
  case14: PropTypes.func,
  /**
   * param with name & description
   * @param event - React's original event
   */
  case15: PropTypes.func,
  /**
   * autofix event-
   * @param event- React's original event
   */
  case16: PropTypes.func,
  /**
   * autofix event.
   * @param event.
   * @returns {string}
   */
  case17: PropTypes.func,
  /**
   * with an empty param.
   * @param
   */
  case18: PropTypes.func,
  /**
   * with multiple empty params.
   * @param
   * @param
   * @param
   */
  case19: PropTypes.func,
  /**
   * with arg alias.
   * @arg event
   */
  case20: PropTypes.func,
  /**
   * with argument alias.
   * @argument event
   */
  case21: PropTypes.func,
  /**
   * with multiple params.
   * @param {SyntheticEvent} event
   * @param {string} stringValue
   * @param {number} numberValue
   */
  case22: PropTypes.func,
  /**
   * with an empty returns
   * @returns
   */
  case23: PropTypes.func,
  /**
   * with a returns with a type
   * @returns {SyntheticEvent}
   */
  case24: PropTypes.func,
  /**
   * with a returns with a type & description
   * @returns {SyntheticEvent} - React's original event
   */
  case25: PropTypes.func,
  /**
   * single param and a returns
   * @param {string} stringValue
   * @returns {SyntheticEvent} - React's original event
   */
  case26: PropTypes.func,
  /**
   * multiple params and a returns
   * @param {string} stringValue
   * @param {number} numberValue
   * @returns {SyntheticEvent} - React's original event
   */
  case27: PropTypes.func,
  /**
   * multiple returns
   * @returns {SyntheticEvent} - React's original event
   * @returns {string} - Second returns
   */
  case28: PropTypes.func,
  /**
   * param with unsupported JSDoc tags
   * @param {SyntheticEvent} event - React's original event
   * @type {number}
   * @version 2
   */
  case29: PropTypes.func,
  /**
   * param record type
   * @param {{a: number, b: string}} myType
   */
  case30: PropTypes.func,
  /**
   * param array type
   * @param {string[]} myType
   */
  case31: PropTypes.func,
  /**
   * param union type
   * @param {(number|boolean)} myType
   */
  case32: PropTypes.func,
  /**
   * param any type
   * @param {*} myType
   */
  case33: PropTypes.func,
  /**
   * param repeatable type
   * @param {...number} myType
   */
  case34: PropTypes.func,
  /**
   * optional param
   * @param {number} [myType]
   */
  case35: PropTypes.func,
  /**
   * optional param
   * @param {number} [myType]
   */
  case36: PropTypes.func,
  /**
   * dot in param name
   * @param {number} my.type
   */
  case37: PropTypes.func,
  /**
   * returns record type
   * @returns {{a: number, b: string}}
   */
  case38: PropTypes.func,
  /**
   * returns array type
   * @returns {string[]}
   */
  case39: PropTypes.func,
  /**
   * returns union type
   * @returns {(number|boolean)}
   */
  case40: PropTypes.func,
  /**
   * returns any type
   * @returns {*}
   */
  case41: PropTypes.func,
  /**
   * returns primitive
   * @returns {string}
   */
  case42: PropTypes.func,
  /**
   * returns void
   * @returns {void}
   */
  case43: PropTypes.func,
};

export const component = JsDocProps;
