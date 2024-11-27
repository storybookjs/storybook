/* eslint-disable no-underscore-dangle */
import { parse, stringify } from 'telejson';

// setting up the store, overriding set and get to use telejson
export default (_: any) => {
  _.fn('set', function (key: string, data: object) {
    return _.set(
      // @ts-expect-error('this' implicitly has type 'any')
      this._area,
      // @ts-expect-error('this' implicitly has type 'any')
      this._in(key),
      stringify(data, { maxDepth: 50, allowFunction: false })
    );
  });
  _.fn('get', function (key: string, alt: string) {
    // @ts-expect-error('this' implicitly has type 'any')
    const value = _.get(this._area, this._in(key));
    return value !== null ? parse(value) : alt || value;
  });
};
