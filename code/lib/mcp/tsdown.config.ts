import sharedTsDownConfig from '../../tsdown-shared.config.ts';
import pkg from './package.json' with { type: 'json' };

export default sharedTsDownConfig(pkg.name);
