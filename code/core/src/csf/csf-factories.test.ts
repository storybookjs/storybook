import { definePreview, definePreview2, definePreviewAddon, type PreviewAddon } from './csf-factories';
import type { Types } from './story';

const addon = definePreviewAddon<{ parameters: { foo: { value: string } } }>({
  parameters: {
    foo: {
      value: 'foo',
    },
  },
});

const addon2 = definePreviewAddon<{ parameters: { bar: { value: string } } }>({
  parameters: {
    bar: {
      value: 'bar',
    },
  },
});

const newVar = [{ foo: { value: 'foo' } }];
const newVar1 = { bar: { value: 'bar' } };

const preview2 = definePreview({ addons: [addon, addon2] });

preview2.parameters?.bar;

type A = { parameters?: { bar?: { value: string } } };
type B = { parameters?: { foo?: { value: string } } };

const a: A = {};
const b: B = {};

interface Addon {
  parameters?: {};
}

export const defineSometing = <T extends Addon>(addons: T[]): T => {};

const preview = defineSometing([a, b]);

interface Animal {
  animalStuff: any;
}
interface Dog extends Types {
  dogStuff: any;
}

interface Bla extends Types {
  blaStuff: any;
}



interface Animal { animalStuff: any; }
interface Dog extends Animal { dogStuff: any; }
interface Dog2 extends Animal { dog2Stuff: any; }

type Type<out T> = (value: T) => void; // Contravariant in T

const handleAnimal: Type<Dog2> = (a: Animal) => console.log(a.dog2stuff);
const handleDog: Type<Dog> = (d: Dog) => console.log(d.dogStuff);

const c = [handleAnimal, handleDog];

type A = typeof c extends Type<infer T>[] ? T: never;
