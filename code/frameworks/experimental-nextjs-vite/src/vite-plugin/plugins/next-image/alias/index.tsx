import { type Env, getEntryPoint } from '../../../utils';

export const getAlias = (env: Env) => ({
  'sb-original/default-loader': getEntryPoint('image-default-loader', env),
  'sb-original/image-context': getEntryPoint('image-context', env),
});
