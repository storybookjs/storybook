import { compileCheckoutPackages, readTemplateCheckoutPackages } from '../lib/templates.ts';

await compileCheckoutPackages(await readTemplateCheckoutPackages());
