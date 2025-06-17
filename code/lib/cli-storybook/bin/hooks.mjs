import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
